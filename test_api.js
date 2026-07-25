const http = require('http');

const data = JSON.stringify({
    username: '0427088602',
    password: 'password123'
});

const req = http.request({
    hostname: 'localhost',
    port: 5002,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log("Login status:", res.statusCode);
        console.log("Login response:", body);
        
        if (res.statusCode === 200) {
            const token = JSON.parse(body).token;
            
            const putData = JSON.stringify({
                isRejected: true,
                catatan: "Revisi from API"
            });
            
            const putReq = http.request({
                hostname: 'localhost',
                port: 5002,
                path: '/api/sidang/approve/13',
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': putData.length,
                    'Authorization': 'Bearer ' + token
                }
            }, (putRes) => {
                let putBody = '';
                putRes.on('data', chunk => putBody += chunk);
                putRes.on('end', () => {
                    console.log("Approve status:", putRes.statusCode);
                    console.log("Approve response:", putBody);
                });
            });
            
            putReq.write(putData);
            putReq.end();
        }
    });
});

req.write(data);
req.end();
