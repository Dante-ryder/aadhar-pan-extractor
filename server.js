const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the Angular app
app.use(express.static(__dirname + '/dist/ocr-tool'));

// All other routes should redirect to the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/dist/ocr-tool/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
