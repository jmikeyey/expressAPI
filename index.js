const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql');
const moment = require('moment');
const PORT = process.env.PORT || 5000;
const crypto = require('crypto');

const conn = mysql.createConnection({
     host: 'localhost',
     user: 'root',
     password: '',
     database: 'e-techdepot'
});

conn.connect();

const logger = (req, res, next) => {
     console.log(`${req.protocol}://${req.get('host')}${req.originalUrl} : ${moment().format()}`);
     next();
}

app.use(logger);
app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.get('/', (req, res) => {
     res.send('<h1>Hello World testing</h1>');
});

//! account creation
app.post('/api/account', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const usertype = 'customer'
    const token = crypto.randomBytes(64).toString('hex')
    conn.query(`INSERT INTO usersprofile (username, password, usertype, token) VALUES (?, ?, ?, ?)`, [username, password, usertype, token], (err, result) => {
        if (err) {
            res.status(500).json({ success: false, message: 'User profile creation failed' });
            throw err; // You may want to remove this line depending on your error handling strategy
        }
        res.json({ success: true, message: 'User profile created successfully' , token: `${token}`});
    });
});
//! account login
app.post('/api/login', (req, res)=>{
    const user = req.body.user
    const pass = req.body.pass
    const token = req.headers['authorization'].split(' ')[1]

    if(!user || !pass){
        res.status(400).json({
            success: 'failed',
            message: 'No inputs'
        })
    }

    conn.query('SELECT * FROM usersprofile WHERE username = ? AND password = ? AND token = ?',[user, pass, token], (err, result)=>{
        if(err){
            res.status(500).json({
                success: false,
                message: 'Server Error'
            })
        }
        if(result.length > 0){
            const userID = result[0].user_id;
            const token = result[0].token;
            const token_use = result[0].token_use;
            if(token_use === 'yes'){
                res.json({
                    success: false,
                    message: 'Account already logged in'
                })
            }else{
                conn.query('UPDATE usersprofile SET token_use = "yes" WHERE user_id = ?', [userID])
                res.json({ user_id: userID, token: token, message: 'Log in successful'});
            }
        }else{
            res.status(401).json({
                success: false,
                message: 'Invalid Credentials'
            })
        }
    })
})
//! account log out
app.post('/api/logout', (req, res)=>{
    const user = req.body.user
    const pass = req.body.pass
    const token = req.headers['authorization'].split(' ')[1]

    if(!user || !pass){
        res.status(400).json({
            success: 'failed',
            message: 'No username / password'
        })
    }

    conn.query('SELECT * FROM usersprofile WHERE username = ? AND password = ? AND token = ?',[user, pass, token], (err, result)=>{
        if(err){
            res.status(500).json({
                success: false,
                message: 'Server Error'
            })
        }
        if(result.length > 0){
            const userID = result[0].user_id;
            const token = result[0].token;
            const token_use = result[0].token_use;
        if(token_use === 'no'){
            res.json({
                success: false,
                message: 'Account did not logged in'
            })
        }else{
            conn.query('UPDATE usersprofile SET token_use = "no" WHERE user_id = ?', [userID])
            res.json({ user_id: userID, token: token, message: 'Log out successful'});
        }
        }else{
            res.status(401).json({
                success: false,
                message: 'Invalid Credentials'
            })
        }
    })
})
//! token checking
app.get('/api/token/:token', (req, res) => {
    const token = req.params.token;
    conn.query('SELECT * FROM usersprofile WHERE token = ? AND token_use = "yes" ', [token], (err, result) => {
        if (err) {
            res.status(500).json({ success: false, message: 'Internal Server Error' });
            throw err; // Handle error appropriately (log, notify, etc.)
        }

        if (result.length > 0) {
            res.json({ success: true, message: 'Token is valid', user: result[0] });
        } else {
            res.status(404).json({ success: false, message: 'Token not found/Not logged in' });
        }
    });
});

// ? ======================== UNAUTHORIZE IF WRONG TOKEN ======================== ? //
//! add to cart
app.post('/api/cart', (req, res)=>{
    const user_id = req.body.user_id
    const prod_id = req.body.product
    const quantity = req.body.quantity

    const is_ordered = 'Not'
    const token = req.headers['authorization'].split(' ')[1]

    conn.query(`SELECT * FROM usersprofile WHERE token = ?`, [token], (err, result)=>{
        if(err){
            res.status(500).json({
                success: false,
                message: 'Server Error'
            })
        }
        if(result.length > 0){
            conn.query('INSERT INTO cart (user_id, product_id, quantity, is_ordered) VALUES (?,?,?,?)', [user_id, prod_id, quantity, is_ordered], (err, result)=>{
                if(err){
                    res.status(500).json({
                        success: false,
                        message: 'An error occured'
                    })
                }

                if(result.affectedRows > 0){
                    res.json({
                        success: true,
                        message: 'Added to cart!' 
                    })
                }else{
                    res.json({
                        message: "Failed"
                    })
                }
            })
        }else{
            res.status(401).json({
                success: false,
                message: 'Authentication Failed'
            })
        }
    })
})
//! get all cart
app.get('/api/carts', (req, res)=>{
    const token = req.headers['authorization'].split(' ')[1]

    conn.query('SELECT * FROM usersprofile WHERE token = ? ', [token], (err, result)=>{
        if(err){
            res.status(500).json({
                success: false,
                message: 'Server Error'
            })
            return
        }

        if(result.length > 0){
            conn.query(`SELECT a.*, b.*, c.token, d.filename, e.name as category_name
            FROM product a
            INNER JOIN cart b ON a.product_id = b.product_id
            INNER JOIN category e ON a.category_id = e.category_id
            INNER JOIN usersprofile c ON b.user_id = c.user_id
            LEFT JOIN (
                SELECT product_id, filename
                FROM product_image
                GROUP BY product_id
            ) d ON d.product_id = b.product_id
            WHERE c.token = ? AND b.is_ordered != 'Ordered'`, [token], (err, result)=>{
                if(err){
                    res.status(500).json({
                        success: false,
                        message: 'Serer Error'
                    })
                }
                if(result.length > 0){
                    const cart = result
                    res.json({
                        cart
                    })
                }else{
                    res.json({
                        message: 'No card added',
                        cart: result
                    })
                }
            })
        }else{
            res.status(401).json({
                success: false,
                message: 'Authentication failed'
            })
        }
    })
})
//! update cart
app.put('/api/carts/:id/:prod', (req, res)=>{
    const token = req.headers['authorization'].split(' ')[1]
    const quantity = req.params.id
    const prod_id = req.params.prod
    conn.query('SELECT * FROM usersprofile WHERE token = ? ', [token], (err, result)=>{
        if(err){
            res.status(500).json({
                success: false,
                message: "Server Error"
            })
        }
        
        if(result.length > 0){
            const user_id = result[0].user_id
            if(!quantity || !prod_id){
                res.status(400).json({
                    success: false,
                    message: "No inputs"
                })
            }
            conn.query('UPDATE cart SET quantity = quantity + ? WHERE product_id = ? and user_id = ?', [quantity, prod_id, user_id], (err, result)=>{
                if(err){
                    res.status(500).json({
                        success: false,
                        message: 'Server Error'
                    })
                }
                if(result.affectedRows > 0){
                    res.json({
                        success: true,
                        message: "Cart quantity updated"
                    })
                }else{
                    res.json({
                        success: false,
                        message: "Cart not found"
                    })
                }
            })
        }else{
            res.status(401).json({
                success: false,
                message: "Authentication failed"
            })
        }
    })
})
//! delete cart
app.delete('/api/carts/:id', (req, res)=>{
    const cart_id = req.params.id
    const token = req.headers['authorization'].split(' ')[1]

    conn.query('SELECT * FROM usersprofile WHERE token = ? ', [token], (err, result)=>{
        if(err){
            res.status(500).json({
                success: false,
                message: "Server Error"
            })
        }
        if(result.length > 0){
            // di ma delete ang dili iyahang cart
            const user_id = result[0].user_id
            // checking the cart truthfully
            conn.query('SELECT * FROM cart WHERE cart_id = ? AND user_id = ?', [cart_id, user_id], (err, result)=>{
                if(err){
                    res.status(501).json({
                        success: false,
                        message: 'Server Error'
                    })
                }
                if(result.length > 0){
                    conn.query('DELETE FROM cart WHERE cart_id = ?', [cart_id], (err, result)=>{
                        if(err){
                            res.status(500).json({
                                success: false,
                                message: 'Server Error'
                            })
                        }
                        if(result.affectedRows > 0){
                            res.json({
                                success: true,
                                message: 'Cart Removed'
                            })
                        }else{
                            res.json({
                                success: false,
                                message: 'Cart does not exist'
                            })
                        }
                    })
                }else{
                    conn.query('SELECT * FROM cart WHERE cart_id = ?', [cart_id], (err, result)=>{
                        if(err){
                            res.status(500).json({
                                success: false,
                                message: 'Server Error'
                            })
                        }
                        if(result.length > 0){
                            res.status(400).json({
                                success: false,
                                message: "Cart is not yours"
                            })
                        }else{
                            res.status(400).json({
                                success: false,
                                message: "Cart is not found"
                            })
                        }
                    })
                }
            })

        }else{
            res.status(401).json({
                success: false,
                message: "Authentication Failed"
            })
        }
    })

})
// get specific cart id
app.get('/api/carts/:id', (req, res) => {
    const id = req.params.id;
    conn.query(`SELECT * FROM cart WHERE cart_id = ${id}`, (err, rows, fields) => {
        if (err) {
            res.status(500).json({ error: 'Internal Server Error' });
            throw err;
        }
        res.json(rows);
    });
});


app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => {
     console.log(`Server is started in port ${PORT}`);
})