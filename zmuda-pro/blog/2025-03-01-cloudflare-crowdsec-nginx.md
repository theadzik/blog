---
slug: cloudflare-crowdsec-nginx
title: Protect Your Public Website with Cloudflare Tunnels, CrowdSec, and NGINX
authors: adzik
tags: [kubernetes, security, cloudflare, crowdsec, nginx]
toc_min_heading_level: 2
toc_max_heading_level: 3
---

Hosting a public website can be stressful. It's constantly being scanned for vulnerabilities.
Today, I'll share how I used Cloudflare Tunnels, CrowdSec,
and NGINX to block ~~all~~ as many threats as possible so I can sleep at night.

<!-- truncate -->

## Intro

When I first built my cluster I went with the easy way to expose my website.
I bought a domain, forwarded port 443 on my router, and created a DNS entry.
Lastly a quick setup of [cert-manager](https://cert-manager.io/) and my website was up. Yay!

Even though I knew that any public IP address, any website will be scanned for known vulnerabilities,
looking at my ingress logs made me feel uneasy.
I wanted to make sure I put some security layers, so I can sleep better at night.

I decided to do two things:

1. Stop exposing my public IP address (This is also a great way if your ISP has CG-NAT)
1. Block requests that scan for known vulnerabilities.

## Act 1 - Cloudflare tunnels

To achieve requirement no. 1,
I decided to use
[cloudflare tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)

When creating a Public Hostname in the dashboard I used:

* Subdomain: left empty
* Domain: `zmuda.pro`
* Path: left empty
* Type: `HTTPS`
* URL: `ingress-nginx-controller.ingress-nginx.svc.cluster.local:443` my internal ingress-controller service address
* Additional application settings:
    * TLS -> Origin Server Name: `zmuda.pro`
    * TLS -> HTTP2 connection: Enabled

The `Origin Server Name` is important. We need to tell ingress-nginx which site to serve and which certificate to use.
If you don't have cert-manager set up, you can also change the `Type` to `HTTP`.

We are ready on cloudflare side. Time to install a client.

### Install Cloudflared

I found example
configuration [here](https://github.com/cloudflare/argo-tunnel-examples/blob/master/named-tunnel-k8s/cloudflared.yaml).

I created my own ConfigMap. I mirrored ingress rules from the previous step, and added

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudflared
  namespace: cloudflared
data:
  config.yaml: |
    tunnel: 01234567-89ab-cdef-0123-456789abcdef
    credentials-file: /etc/cloudflared/creds/credentials.json
    metrics: 0.0.0.0:2000
    no-autoupdate: true
    ingress:
      - hostname: zmuda.pro
        originServerName: zmuda.pro
        service: https://ingress-nginx-controller.ingress-nginx.svc.cluster.local:443
        http2Origin: true
      - service: http_status:404
```

To create secret you can use this command, use your own token created on the dashboard.

```bash
kubectl create secret generic tunnel-credentials --from-literal credentials.json=eyJBY...
```

You now should be able to visit your website using tunnels!

### Changes to nginx

Because we are now using cloudflare as a proxy, if we check logs of our ingress-nginx. We will only see IP of
cloudflared pods.
We want to keep the real IP our visitors so in our ingress-nginx helm values we need to add a few lines:

```yaml
# values.yaml
controller:
  config:
    enable-real-ip: "true"
    forwarded-for-header: "CF-Connecting-IP"
    proxy-real-ip-cidr: "10.0.0.0/8,173.245.48.0/20,103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,141.101.64.0/18,108.162.192.0/18,190.93.240.0/20,188.114.96.0/20,197.234.240.0/22,198.41.128.0/17,162.158.0.0/15,104.16.0.0/13,104.24.0.0/14,172.64.0.0/13,131.0.72.0/22"
    use-forwarded-headers: "true"
```

* `enable-real-ip`: We enable it so we can use `forwarded-for-header` below.
* `forwarded-for-header`: CloudFlare sends real user IP in `CF-Connecting-IP` header.
* `proxy-real-ip-cidr`: We use a list of [CloudFlare's IP addresses](https://www.cloudflare.com/ips-v4/#)
  and our private `10.0.0.0/8`.
* `use-forwarded-headers`: We enable `X-Forwarded-*` headers. We will need it for CrowdSec later.

## Act 2 - CrowdSec

> :warning: Ingress Nginx Version 1.12 or higher currently is not supported by CrowdSec
> due to removal of Lua plugins support.
> See [this issue](https://github.com/crowdsecurity/cs-openresty-bouncer/issues/60)
> for latest news.
> I'm using ingress-nginx helm chart version 4.11.x for that reason.


DDoS protection is nice, but what about scanners we saw in our logs?
Use [crowdsec](https://app.crowdsec.net/security-engines)
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
