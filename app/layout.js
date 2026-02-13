// app/layout.js
export const metadata = {
  title: 'Social Radar — Decode What They Actually Mean',
  description: 'Paste any text, email, DM, or work message. AI tells you what they really mean, hidden tone, interest level, power dynamics, and manipulation signals.',
  manifest: '/manifest.json',
  themeColor: '#07070d',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Social Radar',
  },
  openGraph: {
    title: 'Social Radar',
    description: 'What are they actually thinking? Paste any message and find out.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Anybody:wght@400;700;900&family=IBM+Plex+Mono:wght@400;500;700&family=Source+Serif+4:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
