---
slug: os-ansible-argocd-part-1
title: How I prepare new nodes for my k3s cluster.
authors: adzik
tags: [debian]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

You are probably familiar with the concept of Infrastructure as Code (IaC).
You want your cluster to be created in a repeatable and predictable way.
Today I'll show you how I prepare new nodes to be added to my cluster.

<!-- truncate -->

## Introduction

Currently, I have a 2-node k3s cluster. One node runs on Raspberry Pi 5 8GB,
and the other one is a GMKTec G3 Plus mini-pic with an Intel N150.

I decided to homogenize my cluster and buy two more GMKTec G3 Plus minis to replace
the Raspberry Pi. Luckily I use ansible and ArgoCD to manage my cluster, so adding new nodes
is a breeze.

This will be a 3-part series where I'll walk through the process of preparing
a new node, installing k3s using ansible, and deploying my workloads using ArgoCD.

## Creating an installation USB stick

I use Debian because it is lightweight and stable. I'll be installing it
offline (because I'm too lazy to drag a monitor to my server closet where I have cable connection)
using a USB stick. I also want the setup to be repeatable and fast, so I'll use
[Debian Preseeding](https://wiki.debian.org/DebianInstaller/Preseed) option to
automate the installation as much as possible.

1. Download the DVD/USB `.iso` file from the
   [Downloading Debian](https://www.debian.org/CD/http-ftp/#stable) page.
2. Connect a USB stick to your computer and check its device name:
   ```bash
   sudo fdisk -l
   ```
   ![usb device](usb-device.webp)
3. I need to add my preseed config to the USB stick.
   I will prepare [WritableUSBStick](https://wiki.debian.org/DebianInstaller/WritableUSBStick)
   to allow it.
   1. 
      ```bash
      parted --script /dev/sda mklabel msdos
      parted --script /dev/sda mkpart primary fat32 0% 100%
      mkfs.vfat /dev/sda1
      mount /dev/sda1 /mnt/data/ck
      ```

      :::note
      Replace /dev/sda with your device name from the previous step
      :::
   2. Copy installer 
https://wiki.debian.org/DebianInstaller/WritableUSBStick
https://preseed.debian.net/debian-preseed/bookworm/amd64-main-full.txt

```bash
openssl passwd -salt some-random-words 'correct-horse-battery-staple'
```

``` filename=/mnt/data/boot/grub/grub.cfg
    menuentry --hotkey=a '... Automated install' {
        set background_color=black
        linux    /install.amd/vmlinuz auto=true priority=high preseed/file=/cdrom/preseed.cfg vga=788 --- quiet 
        initrd   /install.amd/initrd.gz
    }
```

questions:
ip address
hostname

3. Format the USB stick:
   ```bash
   sudo mkfs.vfat -I /dev/sda
   ```
4. Copy the `.iso` file [to the USB stick](https://www.debian.org/releases/testing/amd64/ch04s03.en.html).
   ```bash
   sudo cp debian-12.10.0-amd64-DVD-1.iso /dev/sda
   sudo sync /dev/sda
   ```

## Node preparation

Since I do not have a NAS yet, I don't have PXE server either,
so installing OS is a semi-manual process.

### BIOS settings

Before I start installing OS on my nodes, I make sure that the server
automatically boots after power loss. I do it in the BIOS settings:
![bios settings wake on power](bios.webp)
> Wake on Power is a feature that allows the server to automatically power on after a power loss.

Because GMKTec G3 Plus doesn't have a sticker with MAC address on it, I also write it down from the BIOS settings.

### Setting up static IP

Last thing is to set up a static IP address for each node. I have a TP-Link router and I can do it in the web interface:
![dhcp settings](dhcp.webp)

### Installing OS

<!-- TODO: Add screenshots -->

During the installation I create a user and add a public ssh key
I generated on my laptop to the `~/.ssh/authorized_keys` file.
