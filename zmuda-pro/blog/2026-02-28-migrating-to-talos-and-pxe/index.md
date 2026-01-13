---
slug: migrating-to-talos-and-pxe
title: Migrating to Talos Linux and PXE Boot
authors: adzik
tags: [iac, kubernetes]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

I decided I don't want to run my homelab on Debian anymore.
It was working fine, I had no problems at all... and maybe that was the problem.
I wanted to try something new, get out of my comfort zone, learn new things.

<!-- truncate -->

## Why Talos Linux?

During KubeCon Europe 2025 I attended a talk
[Day-2’000 - Migration From Kubeadm+Ansible To ClusterAPI+Talos](https://www.youtube.com/watch?v=uQ_WN1kuDo0).
A minimal Linux distro designed specifically for running
Kubernetes clusters sounded like a good alternative to Debian + k3s. Since Synology DS923+ supports PXE booting,
I can also skip managing OS installations on my nodes.

## Creating Talos PXE boot images

Let's start with creating Talos image. I will use https://factory.talos.dev for that. I selected those options:

   ```yaml
   # ca3fbb9c3bb73ff71b7629ef5b487c827b93878609f361b0e1e555342378b595
   customization:
     systemExtensions:
       officialExtensions:
         - siderolabs/i915 # for Intel graphics
         - siderolabs/iscsi-tools # for iSCSI storage
         - siderolabs/nut-client # for UPS support
   ```

Now I can use the ID generated and pluck it into the download URL: `https://factory.talos.dev/image/<id>/<version>/metal-amd64-uki.efi`
`https://factory.talos.dev/image/376567988ad370138ad8b2698212367b8edcb69b5fd68c80be1f2ec7d603b4ba/v1.12.1/metal-amd64-uki.efi`

Download UKI file `metal-amd64-uki.efi`

## Synology setup

Now it's time to set up PXE booting on Synology.

1. Create shared folder "pxe"
2. Put downloaded file there
3. Disable DHCP on router
4. Enable DHCP server on Synology with those settings:
5. I added my nodes MAC addresses with fixed IPs
6. Enable PXE and select uki file as boot file

## Creating Talos configs

1. Install talosctl https://docs.siderolabs.com/talos/v1.12/getting-started/talosctl
   * `brew install talos-systems/tap/talosctl`
2. ```bash
   export CONTROL_PLANE_IP=192.168.0.2
   export CLUSTER_NAME=homelab-dev
   export DISK_NAME=nvme0n1
   talosctl gen config $CLUSTER_NAME https://$CONTROL_PLANE_IP:6443 --install-disk /dev/$DISK_NAME
   ```
3. Edit `controlplane.yaml` and `worker.yaml` to configure nut-client
https://github.com/siderolabs/extensions/tree/main/power/nut-client

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

4. ```bash
   talosctl apply-config --insecure --nodes $CONTROL_PLANE_IP --file controlplane.yaml
   talosctl --talosconfig=./talosconfig config endpoints $CONTROL_PLANE_IP 
   talosctl bootstrap --nodes $CONTROL_PLANE_IP --talosconfig=./talosconfig
   talosctl kubeconfig --nodes $CONTROL_PLANE_IP --talosconfig=./talosconfig
   ```
