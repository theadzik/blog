---
slug: migrating-to-talos-and-pxe
title: Migrating from k3s to Talos Linux and PXE Boot
authors: adzik
tags: [kubernetes, talos, synology, networking]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

I decided I don't want to run my homelab on Debian anymore.
It was working fine, I had no problems at all... and maybe that was the problem.
I wanted to try something new, get out of my comfort zone and learn new things.
I heard of Talos and PXE but never actually configured them myself.

<!-- truncate -->

## Why Talos Linux?

During KubeCon Europe 2025 I attended a talk
[Day-2’000 - Migration From Kubeadm+Ansible To ClusterAPI+Talos](https://www.youtube.com/watch?v=uQ_WN1kuDo0).
Talos is a minimal Linux distro, designed specifically for running
Kubernetes clusters. It sounded like a good alternative to Debian + k3s. Combining Talos with PXE boot would eliminate
the need to [install OS from USB drive](../2025-04-05-os-ansible-argocd-part-1/index.md)
and to [manage configuration with Ansible](../2025-04-06-os-ansible-argocd-part-2/index.md).

## Creating Talos PXE boot images

Let's start with creating a Talos image using https://factory.talos.dev. I selected options matching my hardware:

- Bare-metal Machine
- The newest Talos version (v1.12.1 at the time of writing)
- amd64 architecture
- SecureBoot disabled
- System Extensions:
  - `siderolabs/i915` for Intel graphics
  - `siderolabs/iscsi-tools` # for iSCSI storage
  - `siderolabs/nut-client` # for UPS support
- No extra kernel commands
- Bootloader: auto

As a result I got a schematic and its ID:

```yaml
# ca3fbb9c3bb73ff71b7629ef5b487c827b93878609f361b0e1e555342378b595
customization:
  systemExtensions:
    officialExtensions:
      - siderolabs/i915
      - siderolabs/iscsi-tools
      - siderolabs/nut-client
```

The final page will have links to download all kinds of images, but I only need the Unified Kernel Image (UKI) for PXE booting.
In the future I won't need to go through the web interface.
I can just save the schematic ID and use it to get an updated image directly:
`https://factory.talos.dev/image/<id>/<version>/metal-amd64-uki.efi`

## Synology setup

Now it's the time to enable PXE and TFTP. Since my router's DHCP does not allow PXE I had to use Synology as DHCP server.
If your router supports PXE booting you can skip this part.

### DHCP

The first step is to give Synology a static IP so it doesn't need to assign one to itself. It can be done
in **Control Panel** -> **Network** -> **Network Interface** -> **Edit**:

![static ip](static-ip.webp)

After that I navigated to Synology's **Package Center** and installed the **DHCP Server** package:

![DHCP Server package](package-center.webp)

Then I opened **DHCP Server** app -> **Network Interface** -> Select **LAN 1** -> **Edit**
and copied settings and reserved clients (MACs and IPs) from my router.

![DHCP settings](dhcp-settings.webp)

When DHCP was configured on Synology I disabled it on my router to avoid conflicts.

### TFTP

Next step was to enable TFTP server on Synology. To do that I created a shared folder named `pxe`
and put `metal-amd64-uki.efi` file there. Then I went to **Control Panel** -> **File Services** -> **Advanced** tab
and enabled TFTP service, setting the root directory to `/volume1/pxe`:

![TFTP settings](tftp-settings.webp)

### PXE

Finally, I had to configure DHCP options for PXE booting. In **DHCP Server** app -> **PXE** tab I enabled PXE service
for Local TFTP server and set the bootloader `metal-amd64-uki.efi`:

![PXE settings](pxe-settings.webp)

## Testing PXE boot

Now it's time to test if PXE booting works. I had an unused laptop lying around so I configured its BIOS to boot from
disk first and then from network. It might sound counter-intuitive, but it's a recommendation from 
[Talos docs](https://docs.siderolabs.com/talos/v1.12/platform-specific-installations/bare-metal-platforms/pxe)

> Note: If there is already a Talos installation on the disk,
> the machine will boot into that installation when booting from network.
> The boot order should prefer disk over network.

I wiped the disk, connected the laptop to my LAN via Ethernet and powered it on.

![Laptop Talos Maintenance Mode](laptop-maintenance.webp)

Success! The laptop booted into Talos Maintenance Mode.

## Creating Talos configs

The rest of the process is configuring Talos and Kubernetes cluster.
[Getting started guide](https://docs.siderolabs.com/talos/v1.12/getting-started/getting-started) has all the steps needed,
so I will just summarize them here.

1. Install **talosctl** `brew install talos-systems/tap/talosctl`

2. Generate Talos config files:
   ```bash
   export CONTROL_PLANE_IP=192.168.0.2
   export CLUSTER_NAME=homelab-dev
   export DISK_NAME=nvme0n1
   talosctl gen config $CLUSTER_NAME https://$CONTROL_PLANE_IP:6443 --install-disk /dev/$DISK_NAME
   ```

3. Edit `controlplane.yaml` and `worker.yaml` to configure nut-client extension. 
   I only added nut-client configuration to the bottom of both files:

   ```yaml
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
   
## Future improvements

Now that I have a working Talos PXE boot setup I want to improve it further.
First, I want to automate Talos config apply by using kernel argument `talos.config=https://some-service/talos/config?mac=${mac}`
and exposing an API to serve configs based on MAC addresses.
This will allow new nodes to simply boot and automatically join the cluster as a worker or control-plane node, 
based on their MAC addresses.
Second, I want to configure the cluster properly instead of using the default values. I want to replace flannel
with something supporting network policies.

## Links to documentation
- [Synology TFTP](https://kb.synology.com/en-global/DSM/help/DSM/AdminCenter/file_ftp_tftp)
- [Talos PXE Boot](https://docs.siderolabs.com/talos/v1.12/platform-specific-installations/bare-metal-platforms/pxe)
- [Talosctl](https://docs.siderolabs.com/talos/v1.12/getting-started/talosctl)
- [nut-client extension config](https://github.com/siderolabs/extensions/tree/main/power/nut-client)
