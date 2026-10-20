import { Hono } from 'hono';
import zktecoCdataApp from './cdata/route';
import zktecoDevicecmdApp from './devicecmd/route';
import zktecoGetrequestApp from './getrequest/route';
import zktecoQuerydataApp from './querydata/route';
import { logAdmsRequest } from '../../lib/zkteco/adms-debug';

const zktecoApp = new Hono();

zktecoApp.use('*', logAdmsRequest);
zktecoApp.route('/cdata', zktecoCdataApp);
zktecoApp.route('/getrequest', zktecoGetrequestApp);
zktecoApp.route('/devicecmd', zktecoDevicecmdApp);
zktecoApp.route('/querydata', zktecoQuerydataApp);

// Endpoints a firmware may call that TAAMS does not implement (e.g. registry/push on
// newer dialects). Logged so they show up during rollout; acknowledged so devices don't retry.
zktecoApp.all('*', (c) => {
  console.warn('Unhandled ZKTeco ADMS endpoint', { method: c.req.method, path: c.req.path, sn: c.req.query('SN') ?? null });
  return c.text('OK', 200);
});

export default zktecoApp;
