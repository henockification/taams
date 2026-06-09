import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Taams API</h1>
      <p>API server is running successfully!</p>
      <ul>
        <li><Link href="/api/docs">API Documentation</Link></li>
        <li><Link href="/api/openapi.json">OpenAPI Specification</Link></li>
      </ul>
    </div>
  )
}
