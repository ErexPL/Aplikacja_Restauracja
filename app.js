const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const nodemailer = require('nodemailer');

require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(
    session({
        secret: 'securekey',
        resave: false,
        saveUninitialized: false,
    })
);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const readDB = () => {
    const data = fs.readFileSync('db.json', 'utf8');
    return JSON.parse(data);
};

app.get('/', (req, res) => {
    if (req.session.loggedIn) {
        res.render('nav');
    } else {
        res.render('login');
    }
});

app.post('/login', (req, res) => {
    const { firstName, lastName, email } = req.body;
    const db = readDB();
    const employee = db.employees.find(
        emp =>
            emp.firstName === firstName &&
            emp.lastName === lastName &&
            emp.email === email
    );

    if (employee) {
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Kod weryfikacyjny',
            text: `Twój kod weryfikacyjny to: ${verificationCode}`,
        });

        req.session.verificationCode = verificationCode;
        req.session.employee = {
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email
        };

        res.redirect('/verify');
    } else {
        res.send(`
            <script>
              alert('Nieprawidłowe dane. Spróbuj ponownie.');
              window.location.href = '/';
            </script>
          `);
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Nie można się wylogować.');
        }
        res.redirect('/');
    });
});

app.get('/verify', (req, res) => {
    if (!req.session.verificationCode) {
        return res.redirect('/');
    }
    res.render('verify');
});

app.post('/verify', (req, res) => {
    const { code } = req.body;

    if (parseInt(code) === req.session.verificationCode) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.send(`
            <script>
              alert('Nieprawidłowy kod weryfikacyjny. Spróbuj ponownie.');
              window.location.href = '/';
            </script>
          `);
    }
});

app.get('/reservations', (req, res) => {
    if (req.session.loggedIn) {
        res.render('reservations');
    } else {
        res.redirect('/');
    }
});

app.get('/admin', (req, res) => {
    if (req.session.loggedIn) {
        res.render('admin');
    } else {
        res.redirect('/');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
