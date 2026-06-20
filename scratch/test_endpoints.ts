import http from 'http';

async function request(url: string, method: string = 'GET', headers: any = {}, body?: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: data
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Endpoint & Security Audit ===\n');

  // Test 1: GET /api/gearboxes
  try {
    const res = await request('http://localhost:3001/api/gearboxes');
    console.log(`[1] GET /api/gearboxes: Status = ${res.status}`);
    const data = JSON.parse(res.body);
    console.log(`    Parsed Gearbox Count: ${data.length}`);
    console.log(`    Sample Gearbox: Size=${data[0].size}, Series=${data[0].series}, Nominal=${data[0].nominal}`);
  } catch (err: any) {
    console.log(`[1] GET /api/gearboxes failed: ${err.message}`);
  }

  // Test 2: GET /api/series-ratios
  try {
    const res = await request('http://localhost:3001/api/series-ratios');
    console.log(`\n[2] GET /api/series-ratios: Status = ${res.status}`);
    const data = JSON.parse(res.body);
    console.log(`    Keys exposed: ${Object.keys(data).join(', ')}`);
    console.log(`    Sample ratio list for s1 (first 5): ${data.s1?.slice(0, 5).join(', ')}`);
  } catch (err: any) {
    console.log(`[2] GET /api/series-ratios failed: ${err.message}`);
  }

  // Test 3: Attempt database update without authorization header
  try {
    const res = await request('http://localhost:3001/api/database/update', 'POST', {}, {
      type: 'gearbox_database',
      fileName: 'dummy.xlsx',
      fileData: 'SGVsbG8='
    });
    console.log(`\n[3] POST /api/database/update (No Auth): Status = ${res.status}`);
    console.log(`    Response Body: ${res.body}`);
  } catch (err: any) {
    console.log(`[3] POST /api/database/update (No Auth) failed: ${err.message}`);
  }

  // Test 4: Attempt database update with invalid credentials
  try {
    const res = await request('http://localhost:3001/api/database/update', 'POST', {
      'Authorization': 'Bearer wrong-secret'
    }, {
      type: 'gearbox_database',
      fileName: 'dummy.xlsx',
      fileData: 'SGVsbG8='
    });
    console.log(`\n[4] POST /api/database/update (Wrong Token): Status = ${res.status}`);
    console.log(`    Response Body: ${res.body}`);
  } catch (err: any) {
    console.log(`[4] POST /api/database/update (Wrong Token) failed: ${err.message}`);
  }

  // Test 5: Verify that files inside server/data/ are not served
  try {
    const res = await request('http://localhost:3001/server/data/MAGTORQ_Gearbox_Database_Updated.xlsx');
    console.log(`\n[5] GET /server/data/MAGTORQ_Gearbox_Database_Updated.xlsx: Status = ${res.status}`);
    console.log(`    Response (Truncated): ${res.body.slice(0, 100)}`);
  } catch (err: any) {
    console.log(`[5] GET /server/data/... failed: ${err.message}`);
  }

  // Test 6: Verify direct folder listing /server/data/ is blocked
  try {
    const res = await request('http://localhost:3001/server/data/');
    console.log(`\n[6] GET /server/data/: Status = ${res.status}`);
    console.log(`    Response (Truncated): ${res.body.slice(0, 100)}`);
  } catch (err: any) {
    console.log(`[6] GET /server/data/ failed: ${err.message}`);
  }

  console.log('\n=== Security Audit Complete ===');
}

runTests();
