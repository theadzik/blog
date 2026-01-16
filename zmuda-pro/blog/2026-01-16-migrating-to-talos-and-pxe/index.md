---
slug: talos-linux-using-pxe
title: PXE Booting Talos Linux from Synology NAS
authors: adzik
tags: [kubernetes, talos, synology, networking]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

I decided I no longer wanted to run my homelab on Debian.
It was working fine, but creating images and configuring OS was getting tedious.
I wanted to try something new, get out of my comfort zone and learn new things.
I had heard of Talos and PXE but never actually configured them myself. Time to change that.

<!-- truncate -->

## Why Talos Linux?

During KubeCon Europe 2025 I attended a talk: [Day-2’000 - Migration From Kubeadm+Ansible To
ClusterAPI+Talos](https://www.youtube.com/watch?v=uQ_WN1kuDo0) where Clément Nussbaumer
talked about, among other things, Talos.
It is a minimal Linux distribution designed specifically for running Kubernetes clusters.
It sounded like a good alternative to Debian + k3s. Combining Talos with PXE boot would eliminate the need to
[install an OS from a USB drive](../2025-04-05-os-ansible-argocd-part-1/index.md) and to
[manage configuration with Ansible](../2025-04-06-os-ansible-argocd-part-2/index.md).

## Creating Talos PXE boot images

I started by creating a Talos image using [https://factory.talos.dev](https://factory.talos.dev).
It's a simple step-by-step image creator. I selected options that match my hardware:

- Bare-metal Machine
- The newest Talos version (v1.12.1 at the time of writing)
- amd64 architecture
- SecureBoot disabled
- System Extensions:
  - `siderolabs/i915` for Intel graphics
  - `siderolabs/nut-client` for UPS support
  - `siderolabs/btrfs`
  - `siderolabs/iscsi-tools`
  - `siderolabs/util-linux-tools`
- No extra kernel commands
- Bootloader: auto

As a result, I got a schematic and its ID:

```yaml title="schematic.yaml"
# 87286864e94c7d661c926a524c8e57f84d608488f0cd654a92b1e5f37d48b868
customization:
  systemExtensions:
    officialExtensions:
      - siderolabs/i915
      - siderolabs/nut-client
      # https://github.com/siderolabs/talos/issues/11469#issuecomment-3679454197
      - siderolabs/btrfs
      - siderolabs/iscsi-tools
      - siderolabs/util-linux-tools
```

The final page provides links to download several images, but I only needed the Unified Kernel
Image (UKI) for PXE. In the future I won't need to use the web interface: I can save the
schematic ID and fetch the updated image directly:

```bash
VERSION=1.12.1
wget https://factory.talos.dev/image/$(curl -X POST --data-binary @schematic.yaml https://factory.talos.dev/schematics | jq -r '.id')/$VERSION/metal-amd64-uki.efi
```

## Synology setup

Next, I needed to enable PXE and TFTP. Because my router's DHCP does not support PXE, I configured my
NAS to run a DHCP server. If your router supports PXE booting, you can skip the DHCP section below.

### DHCP

The first step is to assign a static IP to Synology so it doesn't need to assign one to itself. It can be done
in **Control Panel** -> **Network** -> **Network Interface** -> **Edit**:

![static ip](static-ip.webp)

Then I installed the **DHCP Server** package from the **Package Center**.

![DHCP Server package](package-center.webp)

I opened the **DHCP Server** app -> **Network Interface** -> Select **LAN 1** -> **Edit**
and copied the network settings and client reservations (MACs and IPs) from my router.

Once DHCP was configured on the Synology, I disabled DHCP on my router to avoid conflicts.

### TFTP

Next step was to enable TFTP server on Synology. To do that I created a shared folder named `pxe`
and uploaded the `metal-amd64-uki.efi` file there. Then I went to **Control Panel** -> **File Services** -> **Advanced** tab
and enabled TFTP service, setting the root directory to `/volume1/pxe`:

![TFTP settings](tftp-settings.webp)

### PXE

Finally, I configured PXE. In the **DHCP Server** app -> **PXE** tab
I enabled PXE service,
selected Local TFTP server and set the bootloader to `metal-amd64-uki.efi`.

![PXE settings](pxe-settings.webp)

## Testing PXE boot

Now it's time to test if PXE works. I had an unused laptop lying around so I configured its BIOS to boot from
**disk first** and then from network. It may sound counter-intuitive, but it's a recommendation from
[Talos docs](https://docs.siderolabs.com/talos/v1.12/platform-specific-installations/bare-metal-platforms/pxe):

:::note
If there is already a Talos installation on the disk, the machine will boot into that
installation when booting from network. The boot order should prefer disk over network.
:::

I wiped the disk, connected the laptop to my LAN via Ethernet, and powered it on.

![Laptop Talos Maintenance Mode](laptop-maintenance.webp)

Success! The laptop booted into Talos Maintenance Mode.

## Creating Talos configs

The rest of the process is configuring Talos and Kubernetes cluster.
[Getting started guide][getting-started] has all the steps needed,
so I will just summarize them here.

1. Install **talosctl** `brew install talos-systems/tap/talosctl`
2. Create a patch file to customize installation. I added UPS settings and the installer image:

   ```yaml title="patch-all.yaml"
   machine:
     install:
       disk: /dev/nvme0n1
       image: factory.talos.dev/installer/87286864e94c7d661c926a524c8e57f84d608488f0cd654a92b1e5f37d48b868:v1.12.1
   ---
   apiVersion: v1alpha1
   kind: ExtensionServiceConfig
   name: nut-client
   configFiles:
     - content: |-
         MONITOR ups@192.168.0.6 1 monuser secret secondary
         SHUTDOWNCMD "/sbin/poweroff"
       mountPath: /usr/local/etc/nut/upsmon.conf
   ```

   Yes, the secret to my UPS is "secret". Don't judge me.

3. Generate Talos config files:

   ```bash
   export CONTROL_PLANE_IP=192.168.0.2
   export CLUSTER_NAME=homelab-dev

   talosctl gen config $CLUSTER_NAME https://$CONTROL_PLANE_IP:6443 --config-patch @patch-all.yaml
   ```

4. Apply config, set endpoints:

   ```bash
   talosctl apply-config --insecure --nodes $CONTROL_PLANE_IP --file controlplane.yaml
   talosctl --talosconfig=./talosconfig config endpoints $CONTROL_PLANE_IP
   ```

5. Wait for node to reboot and then bootstrap ETCD and get kubeconfig:

   ```bash
   talosctl bootstrap --nodes $CONTROL_PLANE_IP --talosconfig=./talosconfig
   talosctl health --nodes $CONTROL_PLANE_IP --talosconfig=./talosconfig
   talosctl kubeconfig --nodes $CONTROL_PLANE_IP --talosconfig=./talosconfig
   ```

## Workload migration

Next steps are to move workloads from k3s to Talos cluster.
First, I need to make sure Synology CSI works on Talos.
This [GitHub issue](https://github.com/siderolabs/talos/issues/11469#issuecomment-3679454197) nicely describes
what needs to be done. The rest of the migration is restoring PV/PVC with Velero and reapplying
manifests with ArgoCD. At least that's the theory. I'm sure I will need to fix lots of things along the way.
I might write another blog post about it.

## Links to documentation

- [Synology TFTP](https://kb.synology.com/en-global/DSM/help/DSM/AdminCenter/file_ftp_tftp)
- [Talos PXE Boot][talos-pxe]
- [talosctl](https://docs.siderolabs.com/talos/v1.12/getting-started/talosctl)
- [nut-client extension config](https://github.com/siderolabs/extensions/tree/main/power/nut-client)

[talos-pxe]: https://docs.siderolabs.com/talos/v1.12/platform-specific-installations/bare-metal-platforms/pxe
[getting-started]: https://docs.siderolabs.com/talos/v1.12/getting-started/getting-started
