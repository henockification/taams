import { Hono } from 'hono';
import zktecoCdataApp from './cdata/route';
import zktecoGetrequestApp from './getrequest/route';

const zktecoApp = new Hono();

zktecoApp.route('/cdata', zktecoCdataApp);
zktecoApp.route('/getrequest', zktecoGetrequestApp);

export default zktecoApp;
