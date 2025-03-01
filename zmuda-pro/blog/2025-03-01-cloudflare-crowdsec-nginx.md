---
slug: cloudflare-crowdsec-nginx
title: Protect Your Public Website with Cloudflare Tunnels, CrowdSec, and NGINX
authors: adzik
tags: [kubernetes, security, cloudflare, crowdsec, nginx]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

If you've ever tried hosting a public website,
you know it's constantly being scanned for vulnerabilities.
Today, I'll share how I used Cloudflare Tunnels, CrowdSec,
and NGINX to block ~~all~~ as many threats as possible.

<!-- truncate -->

## Intro

So you built your cluster, deployed ingress controller and your first website,
forwarded port 443 on your router. You open the website and it works! Congrats!

You want to see if you have any visitors so you check your reverse proxy logs.

![image of logs](https://as1.ftcdn.net/v2/jpg/11/18/14/06/1000_F_1118140600_zdcwZWu8l3H4teBRGUdCu6YjNSV0qe27.jpg)

Oh, no! Someone is trying to hack you! Time to panic!

Well, not exactly. Any public IP address, any website will be scanned for known vulnerabilities.
If you are using a reverse proxy, like ingress-nginx you are already quite secure.

Even though I knew this, I wanted to make sure I put more layers to my security.

## Act 1 - Cloudflare tunnels

What are cloudflare tunnels? Read [docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).
In a nutshell, tunnels allow you to close all your open ports because you are the one who initiate traffic (open a tunnel).
This way traffic can come in only through clouldflare, which will protect you from DDoS.

### Changes to nginx

```yaml
# values.yaml

x-forwarded-ip: siema
```

## Act 2 - CrowdSec

> Disclaimer: nginx 1.12 doesn't work

DDoS protection is nice, but what about scanners we saw in our logs? Use [crowdsec](https://app.crowdsec.net/security-engines)
to ban known malicious IPs.

### Portal

What to do on portal?

### Changes to ingress-nginx

```yaml
# values.yaml

values:
  go:
    here: "elo"
```
