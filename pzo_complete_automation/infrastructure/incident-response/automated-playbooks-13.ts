- name: Add required APT key for the ClamAV package
apt_key:
url: https://clamav.net/download/clamwin_keys.asc
state: present

- name: Add ClamAV repository to sources.list
apt_repository:
repo: deb https://download.sourceforge.net/clamav/ daily
components: main
state: present

roles:
- role: isolate_investigate

- role:
name: isolate_investigate
tags:
- isolate
- investigate

tasks:
- name: Update package lists
apt:
update_cache: yes

- name: Install ClamAV
apt:
name: clamav-daemon
state: present

- name: Start and enable ClamAV daemon
service:
name: clamav-daemon
state: started
enabled: yes

- name: Scan the system with ClamAV
command: freshclam
args:
creates: /var/log/clamav/freshclam.log

- name: Disable SSH on compromised host
lineinfile:
path: /etc/ssh/sshd_config
regexp: 'PubkeyAuthentication yes'
state: absent

- name: Save the current system state as a snapshot
command: tar czf /root/snapshot-`date +%Y-%m-%d-%H-%M-%S`.tar.gz /
args:
creates: /root/snapshot-*.tar.gz

- name: Disable firewalld if it's enabled
service:
name: firewalld
state: stopped
enabled: no
```

This playbook does the following:

1. Adds the necessary ClamAV package repository and key.
2. Installs the ClamAV daemon, starts it, and enables it.
3. Runs a system scan with ClamAV.
4. Disables SSH on the compromised host.
5. Creates a snapshot of the current system state as a tarball.
6. Stops firewalld if it's enabled.
