---
slug: os-ansible-argocd-part-2
title: Adding new nodes to my k3s cluster in under 10 minutes - Ansible
authors: adzik
tags: [ansible, iac, kubernetes]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

In the [previous post](../2025-04-05-os-ansible-argocd-part-1/index.md) I installed Debian on a new server.
Now it's time to configure it and add it to the cluster.
Of course, we want to automate this process. Ansible is my tool of choice for this task.

<!-- truncate -->

## Introduction

[Ansible](https://docs.ansible.com/) is an automation tool that allows you to manage
and configure systems. I'm using it for both my local environment and my servers.
To use Ansible you have to install it on your control machine. In my case, it's my laptop.
Ansible only works on UNIX-like systems. If you are using Windows, you have to use WSL or a VM.

Ansible uses SSH to connect to the remote machines, you have to have SSH access to the machines you want to manage.
I've added my SSH key to the new server in the previous post. So I'm ready to go.

If you never used Ansible before,
I recommend watching [Ansible 101](https://www.youtube.com/playlist?list=PL2_OBreMn7FqZkvMYt6ATmgC0KAGGJNAN)
series by [Jeff Geerling](https://www.youtube.com/@JeffGeerling).

## Installing Ansible

Ansible is installed using pipx. I created a script to install it on my machine.

```bash title="bootstrap-ansible.sh"
#!/usr/bin/env bash
set -e

sudo apt-get update
sudo apt-get install pipx -y
pipx ensurepath

pipx install --include-deps ansible
```

This is it. Ansible is now installed and ready to use.

## Ansible

Luckily, we don't have to write the whole playbook from scratch.
[k3s-ansible](https://github.com/k3s-io/k3s-ansible) repository is a part of the official
k3s project. It contains a set of roles that can be used to install and configure k3s.

The repository is well documented, so I won't go into details here. I copied contents of the repo to my own.
I've also added some custom roles to the repository and edited existing ones.

## Inventory

Ansible uses an inventory file to define the hosts that have to be managed.

```yaml title="inventory.yaml"
all: # This is a group that contains all hosts
  children:
    k3s_cluster: # This is a group that contains all hosts in the cluster
      children:
        server:
          hosts:
            192.168.0.4: # I have 3 control-plane nodes
            192.168.0.3:
            192.168.0.5:
        agent:
          hosts: # and 0 worker nodes
      # Those are variables that will be used during the playbook execution
      vars: 
        ansible_port: 22
        k3s_version: v1.32.2+k3s1
        api_endpoint: "{{ hostvars[groups['server'][0]]['ansible_host'] | default(groups['server'][0]) }}"
        ansible_private_key_file: ~/.ssh/id_ed25519
        server_config_yaml: |
          disable:
            - traefik # I don't need traefik, because I use ingress-nginx
            - servicelb # I don't need ServiceLB, because I use MetalLB
          # See https://docs.k3s.io/security/hardening-guide?_highlight=kernel
          protect-kernel-defaults: true
        agent_config_yaml: |
          protect-kernel-defaults: true
        # This is how I bootstrap ArgoCD. I will explain in more details in the next post.
        extra_manifests:
          - 'files/argocd-install.yaml'
          - 'files/argocd-bootstrap.yaml'
          - 'files/argocd-namespace.yaml'

    gpu: # This is a group that contains all hosts with GPU
      children:
        intel:
          hosts:
            192.168.0.3:
            192.168.0.4:
            192.168.0.5:
  vars:
    ansible_user: adzik
```

This is a simple inventory file that defines two groups: `server` and `agent`.
I want my cluster to be highly available. I chose to run 3 control plane nodes
instead of 1 control plane and 2 worker nodes. 

This setup has some drawbacks, but since I don't host any resource intensive workloads,
I don't mind having all nodes as control plane nodes.

## Playbook

My playbook is based on the one from the repo mentioned earlier, but I've added a few of my own roles and
edited some of the existing ones. I've also removed some of the roles that I don't need.

```yaml title="playbook.yaml"
---
- name: Cluster prep
  hosts: k3s_cluster
  gather_facts: true
  become: true
  pre_tasks:
    - name: Upgrade system with apt. # Before doing anything else I want to make sure my packages are up to date.
      ansible.builtin.apt:
        upgrade: true
        cache_valid_time: 3600
  roles:
    - role: prereq # This role is taken from the k3s-ansible repo, but I made a few additions.
    - role: gpu_drivers # My servers have integrated Intel GPUs, I need to make sure my kernel is at least version 6.9.
      vars:
        linux_image_version: 6.12.12+bpo-amd64 # I'm installing kernel version 6.12.12
    - role: fail2ban # Even though I'm not exposing my servers to the internet, I want to have some basic security in place.
    - role: ssh_hardening # Built on https://www.sshaudit.com/hardening_guides.html#debian_12
    - role: argo_storage # Because I use git-crypt to encrypt my git repository, I need to make sure that ArgoCD has the key.
      vars:
        argo_name: argocd
        uid: 999
        gid: 999
        git_crypt_source: "../../../git-crypt-key"
  handlers: # Some roles (gpu_drivers) require a reboot after installation.
    - name: Reboot machine
      ansible.builtin.reboot:

- name: Setup K3S server # This role is taken from the k3s-ansible repo.
  hosts: server
  become: true
  roles:
    - role: k3s_server
      vars:
        cluster_context: "home-prod"

- name: Setup K3S agent
  hosts: agent
  become: true
  roles:
    - role: k3s_agent
```

## Updated roles

I've made a few changes to the roles that I'm using. You can check the full configuration
[here](https://github.com/theadzik/homelab/tree/8e412634ae828d4bbf205e4479d79f3a1726cd36/ansible). Below I'll
highlight most important changes.

### Prereq

This is a snippet from the `prereq` role. I've added a few tasks to set kernel parameters and disable swap.

```yaml title="roles/prereq/tasks/main.yaml"
# I added that at the end.
- name: Ensure packages are present.
  ansible.builtin.apt:
    name: "{{ item }}"
    state: present
  loop: "{{ prereq_packages }}"

- name: Set kernel parameters
  when: kubelet_conf is defined
  ansible.posix.sysctl:
    name: "{{ item.key }}"
    value: "{{ item.value }}"
    state: present
    sysctl_file: "{{ kubelet_conf_dest }}"
  with_dict: "{{ kubelet_conf }}"
  notify: Reboot machine

- name: Disable swap permanently, persist reboots
  replace:
    path: /etc/fstab
    regexp: '^(\s*)([^#\n]+\s+)(\w+\s+)swap(\s+.*)$'
    replace: '#\1\2\3swap\4'
  when:
    - ansible_distribution == 'Debian'
    - ansible_swaptotal_mb > 0
  notify: Reboot machine
```

I've added the below default variables to the roles:

```yaml title="roles/prereq/defaults/main.yaml"
prereq_packages:
  - wget # So I can download installation scripts later in the playbook
  - curl
  - vim
  - open-iscsi  # Needed for Synology CSI
  - nfs-common  # Needed for Synology CSI
kubelet_conf: # https://docs.k3s.io/security/hardening-guide#host-level-requirements
  vm.panic_on_oom: 0
  vm.overcommit_memory: 1
  kernel.panic: 10
  kernel.panic_on_oops: 1
  fs.inotify.max_user_instances: 1024 # Jellyfin had problems to start when this was 128
  fs.inotify.max_user_watches: 1048576
kubelet_conf_dest: "/etc/sysctl.d/90-kubelet.conf"
```

### GPU drivers

This role updates the kernel to the specified version. I only temporarily added backports to the apt sources list
since I don't want to have them permanently enabled. I've also added a task to update the initramfs and grub.

```yaml title="roles/gpu_drivers/tasks/main.yaml"
- name: Check kernel version
  ansible.builtin.command:
    cmd: uname -r
  register: kernel_version
  changed_when: false
- name: Download kernel and gpu drivers.
  when: ansible_distribution  == "Debian" and kernel_version.stdout != linux_image_version
  block:
    - name: Add backports to apt sources for kernel update
      ansible.builtin.lineinfile:
        path: /etc/apt/sources.list
        regexp: 'bookworm-backports'
        line: 'deb http://deb.debian.org/debian bookworm-backports main # Added by k3s-ansible'
        state: present
    - name: Upgrade system with apt.
      ansible.builtin.apt:
        upgrade: true
    - name: Ensure firmware-linux-nonfree is present.
      ansible.builtin.apt:
        name: firmware-linux-nonfree
        state: present
    - name: Ensure linux image version is correct.
      ansible.builtin.apt:
        name: "linux-image-{{ linux_image_version }}"
        state: present
      notify: Reboot machine
    - name: Remove backports from apt sources
      ansible.builtin.lineinfile:
        path: /etc/apt/sources.list
        regexp: 'deb http://deb.debian.org/debian bookworm-backports main # Added by k3s-ansible'
        state: absent
    - name: Update initramfs
      ansible.builtin.command:
        cmd: update-initramfs -u
    - name: Update grub
      ansible.builtin.command:
        cmd: update-grub
```

### ArgoCD Storage

This role is used to put the git-crypt key on every node in the cluster. This might not be the most secure way to do it,
but I'm stuck with it until I migrate to SoPS or other solution.

The role is pretty straight-forward.

```yaml title="roles/argo_storage/tasks/main.yaml"
- name: "Ensure kubernetes data directory exist."
  ansible.builtin.file:
    path: "{{ local_data_base_directory }}"
    owner: "0"
    group: "0"
    mode: "0774"
    state: directory

- name: "Ensure kubernetes data directory exist."
  ansible.builtin.file:
    path: "{{ local_data_base_directory }}/{{ argo_name }}"
    owner: "{{ uid }}"
    group: "{{ gid }}"
    mode: "{{ local_data_permissions }}"
    state: directory

- name: "Copy git-crypt key."
  ansible.builtin.copy:
    src: "{{ git_crypt_source }}"
    dest: "{{ local_data_base_directory }}/{{ argo_name }}"
    owner: "{{ uid }}"
    group: "{{ gid }}"
    mode: "0440"
  become: true
```

With default values:

```yaml title="roles/argo_storage/defaults/main.yaml"
local_data_base_directory: /mnt/kubernetes-disks
local_data_permissions: 02774
```

## Running the playbook

To run the playbook, I have to navigate to my **ansible** directory and run this command:

```bash
$ ansible-playbook playbooks/servers-setup.yaml --ask-become-pass
BECOME password:
```

This will prompt you for the sudo password to the server.

![Ansible playbook](/img/2025-04-06-ansible.webp)

## Conclusion

In this post, I showed you how to use Ansible to automate the installation of k3s on a new server.
I've also showed you how to use Ansible to install GPU drivers and configure the system.
In the next post, I will show you how to use ArgoCD to manage your k3s cluster.
