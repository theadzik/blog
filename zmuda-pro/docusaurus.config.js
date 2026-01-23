// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'zmuda.pro',
  // tagline: 'My journey through technology',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://zmuda.pro',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  trailingSlash: true,

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [require.resolve('docusaurus-plugin-image-zoom')],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/aboutme',
          path: 'content',
          sidebarPath: './sidebars.js',
        },
        blog: {
          routeBasePath: '/', // Serve the blog at the site's root
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/PPBN.webp',
      navbar: {
        title: 'zmuda.pro',
        logo: {
          alt: 'zmuda.pro Logo',
          src: 'img/PPBN.webp',
        },
        items: [
          {to: '/', label: 'Blog', position: 'left'},
          {
            to: '/aboutme',
            position: 'left',
            label: 'About me',
          },
          {
            href: 'https://github.com/theadzik/blog',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Socials',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/users/5947738/theadzik',
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/in/adam-zmuda/',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/theadzik',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Adam Żmuda.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
      zoom: {
        selector: '.markdown :not(em) > img',
        background: {
          light: 'rgb(255, 255, 255)',
          dark: 'rgb(50, 50, 50)'
        },
        config: {
          // options you can specify via https://github.com/francoischalifour/medium-zoom#usage
        }
      },
    }),
};

export default config;
