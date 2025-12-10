// Test server mínimo
const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  console.log('✅ Petición recibida en /');
  res.send('Server funcionando OK');
});

app.post('/test-login', (req, res) => {
  console.log('✅ Petición recibida en /test-login');
  console.log('Body:', req.body);
  res.json({ ok: true, message: 'Test OK' });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`✅ Test server en http://localhost:${PORT}`);
});
