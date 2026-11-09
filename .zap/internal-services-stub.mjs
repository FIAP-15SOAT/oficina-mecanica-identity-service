// Stands in for the Work Order during the DAST scan: without it GET /api/me would answer 503
// and ZAP would flag the 5xx.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const PORT = 3000;
const contractsDir = process.env.CONTRACTS_DIR;

if (!contractsDir) {
  throw new Error('CONTRACTS_DIR is required');
}

const userCustomers = JSON.parse(
  readFileSync(join(contractsDir, 'work-order/internal-user-customers.json'), 'utf8'),
).data;

const reply = (res, statusCode, body) => {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const segments = new URL(req.url ?? '/', 'http://localhost').pathname.split('/');
  const [, prefix, resource, , relation] = segments;

  const isUserCustomers =
    req.method === 'GET' &&
    prefix === 'internal' &&
    resource === 'users' &&
    relation === 'customers' &&
    segments.length === 5;

  if (isUserCustomers) {
    reply(res, 200, { data: userCustomers });
  } else {
    reply(res, 404, { statusCode: 404, error: 'Not Found', message: 'Recurso não encontrado' });
  }
}).listen(PORT, () => console.log(`internal services stub listening on ${PORT}`));
