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
    res.render('home');
});

app.get('/login', (req, res) => {
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
        res.redirect('/login');
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
    if (!req.session.loggedIn) {
        return res.redirect('/');
    }

    const db = readDB();
    const today = new Date().toISOString().split('T')[0];
    
    const todayReservations = db.reservations
        .filter(r => r.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));

    res.render('reservations', { 
        reservations: todayReservations
    });
});

app.get('/admin', (req, res) => {
    if (req.session.loggedIn) {
        res.render('admin');
    } else {
        res.redirect('/');
    }
});

app.get('/reservation-form', (req, res) => {
    res.render('reservation-form');
});

app.get('/api/available-tables', (req, res) => {
    try {
        const db = readDB();
        const { date, time, guests } = req.query;
        
        const availableTables = db.tables.map(table => ({
            id: table.id,
            capacity: table.capacity,
            section: table.section,
            available: table.capacity >= parseInt(guests) && 
                      !db.reservations.some(r => 
                          r.date === date && 
                          r.time === time && 
                          r.tableId === table.id
                      )
        }));

        res.json(availableTables);
    } catch (error) {
        res.status(500).json({ error: 'Błąd podczas pobierania dostępnych stolików' });
    }
});

app.post('/make-reservation', (req, res) => {
    try {
        const db = readDB();
        const { firstName, lastName, email, phone, date, time, guests, tableId } = req.body;

        if (!tableId) {
            throw new Error('Proszę wybrać stolik');
        }

        const table = db.tables.find(t => t.id === parseInt(tableId));
        const isTableBooked = db.reservations.some(r => 
            r.date === date && 
            r.time === time && 
            r.tableId === parseInt(tableId)
        );

        if (!table || isTableBooked || table.capacity < parseInt(guests)) {
            throw new Error('Wybrany stolik nie jest już dostępny');
        }

        const newReservation = {
            id: Date.now(),
            firstName,
            lastName,
            email,
            phone,
            date,
            time,
            guests: parseInt(guests),
            tableId: parseInt(tableId)
        };

        db.reservations.push(newReservation);

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Potwierdzenie rezerwacji - Luminaire',
            text: `
                Dziękujemy za dokonanie rezerwacji!
                
                Szczegóły rezerwacji:
                Imię i nazwisko: ${firstName} ${lastName}
                Data: ${date}
                Godzina: ${time}
                Liczba gości: ${guests}
                Numer stolika: ${tableId}
                
                Pozdrawiamy,
                Zespół Luminaire
            `
        });

        fs.writeFileSync('db.json', JSON.stringify(db, null, 2));

        res.send(`
            <script>
                alert('Rezerwacja została przyjęta. Szczegóły zostały wysłane na podany adres email.');
                window.location.href = '/';
            </script>
        `);
    } catch (error) {
        res.send(`
            <script>
                alert('${error.message}');
                window.history.back();
            </script>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
