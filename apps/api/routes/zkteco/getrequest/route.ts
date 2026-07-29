import { Hono } from 'hono';

const zktecoGetrequestApp = new Hono();

zktecoGetrequestApp.get('/', (c) => {
  console.log('Device heartbeat');

  return c.text('OK', 200);
});

export default zktecoGetrequestApp;
