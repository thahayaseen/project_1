const User = require('../../model/user_scema')
const product_schema = require('../../model/product_schema');
const cartschema = require('../../model/cart');
const address_scema = require('../../model/address');
const orderchema = require('../../model/orders')
const wishlist = require('../../model/wishlist')
const passport = require('passport');
const coupencode = require('../../model/coupon')
const Wallet = require('../../model/wallet')
const razorpay = require('../../config/razorpay')
const wishlistschema = require('../../model/wishlist')
const crypto = require('crypto')
const PDFDocument = require('pdfkit');
require('dotenv').config()
const bcrypt = require('bcrypt')
const fs = require('fs');
// register and send otp 
const signup = async (req, res, next) => {
    try {
        const otp = Math.round(100000 + Math.random() * 90000)
        const { name, email, password } = req.body
        const exsist = await User.find({
            $or: [
                { user_name: name },
                { email: email }
            ]
        })
        console.log(exsist);

        if (exsist.length > 0) {
            req.session.register = "User name or email already exist";
            console.log('yess');

            return res.redirect('/signup')
        }
        else {
            function generateUsername(name) {
                const baseUsername = name.toLowerCase().replace(/\s+/g, '');
                const randomNumber = Math.floor(Math.random() * 1000);
                return `${baseUsername}${randomNumber}`;
            }
            const saltRound = 10;
            const hashed_pass = await bcrypt.hash(password, saltRound)
            const userid = generateUsername(name)
            const users = new User({
                name: name,
                user_name: userid,
                email: email,
                password: hashed_pass,
                uotp: otp
            })
            const a = await users.save()
            if (a) {
                cart = new cartschema({ userid: a._id, product: [] });
                await cart.save()
                const cwishlist = new wishlistschema({
                    userid: a._id,
                    productid: []
                })
                await cwishlist.save()
                userdata = new Wallet({
                    userId: a._id,
                    balance: 0,
                    transactions: []
                });
                await userdata.save();
                getotp(email, otp, userid)
                req.session.username = name
                req.session.blocked = a.blocked
                next()
                console.log(a);

                console.log("otp sented");


            }
        }
    } catch (error) {
        console.log("error in signin" + error);
        res.status(500).send('An error ocupied')
    }

}

const blockuser = async (req, res, next) => {
    if (req.session.ulogin) {
        const userdata = req.session.ulogin
        const data = await User.findById(userdata)
        if (!data) {
            console.log('not' + userdata);

            return res.redirect('/signin')
        }
        if (!data.blocked) {
            console.log(data);

            return next()
        }
        else {
            return res.redirect('/logout')
        }
    }
    else {
        next()
    }
}

// otp varifing 
const otpvarify = async (req, res, next) => {
    try {
        // fetch data from usets
        const email = req.session.username;
        const otp = req.body.otp;
        // find user data
        const data = await User.findOne({ name: email });
        // cheking user exist or not
        if (!data) {
            req.session.otperror = "otp not match";
            return res.redirect("/otp");
        }

        //timer
        const created_date = data.updatedAt;
        const now_time = new Date();
        const time = now_time.getTime() - created_date.getTime();
        // otp expaire
        if (time > 60000) {
            req.session.otperror = "otp expaired";
            data.uotp = 0;
            await data.save();
            return res.redirect("/otp");
        }
        const rotp = Number(otp);

        if (data.uotp === rotp) {

            console.log("done");
            data.varify = true
            data.uotp = null
            await data.save()
            res.redirect('/signin')
            // delete req.session.username
            // res.send("gdfgsdgsdsjhd")
        } else {
            req.session.otperror = "please enter valid otp";
            return res.redirect("/otp");
        }
    } catch (error) {
        console.error("Error during OTP verification:", error);
        res.status(500).send("Server error during OTP verification");
    }
};
const { getotp, sendPasswordResetOTP } = require('../../middleware/getotp');
const coupon = require('../../model/coupon');


// resend otp 

const resent = async (req, res, next) => {
    const username = req.session.username
    const users = await User.findOne({ name: username })

    if (!users) {
        res.redirect('/otp')
    }
    const nwotp = Math.round(100000 + Math.random() * 90000)

    users.uotp = nwotp;
    await users.save(),
        console.log('resent otp succsesfully');


    await getotp(users.email, nwotp)

    console.log(users);
    res.redirect('/otp')

}

// login and varifing 

const varifylogin = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        console.log(username, password);

        const check = await User.findOne({ user_name: username, varify: true });

        console.log(check);

        if (!check) {
            req.session.login = "Invalid username or password";
            return res.redirect('/signin');
        }

        const isMatch = await bcrypt.compare(password, check.password);

        if (!isMatch) {
            req.session.login = "Invalid username or password";
            return res.redirect('/signin');
        }

        if (check.blocked) {
            req.session.login = "You have been blocked";
            return res.redirect('/signin');
        }

        req.session.ulogin = check._id;
        return res.redirect('/');

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred during login');
    }
};

const logout = async (req, res, next) => {
    try {
        req.session.destroy();
        console.log("the user logouted");
        return res.redirect('/signin')
    } catch (error) {
        console.log(error);

    }

}

const viewproduct = async (req, res, next) => {
    try {
        const id = req.params.ids;

        // Fetch the product by its ID
        const productdata = await product_schema.findById(id).populate('category_id');

        if (!productdata) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Get products from the same category, excluding the current product
        const sameProducts = await product_schema.find({
            category_id: productdata.category_id._id,
            _id: { $ne: id }
        });

        let poffer = productdata.price - (productdata.price * productdata.offer) / 100
        console.log(poffer);

        if (poffer < productdata.offerdealprice || productdata.offerdealprice == 0) {

            productdata.dealprice = poffer
        }
        else {
            productdata.dealprice = productdata.offerdealprice
            productdata.offtype = productdata.dealoffertype

        }

        res.render('userside/product_over_view', {
            product: productdata,
            sameProducts: sameProducts,

        });

        console.log('Product:', productdata);
        console.log('Same category products:', sameProducts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const glogincb = (req, res, next) => {
    passport.authenticate('google', { failureRedirect: '/' }),
        passport.authenticate('google', (err, user, info) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.redirect('/signin');
            }
            req.logIn(user, (err) => {
                if (err) {
                    return next(err);
                }

                if (!user.blocked) {
                    req.session.ulogin = user._id
                    return res.redirect('/')
                }
                if (user.blocked) {
                    console.log('notok');

                    req.session.login = `your google account ${user.user_name} has been blocked`
                    return res.redirect('/signin')
                }
            });
        })(req, res, next);
}
const removewish = async (req, res) => {
    const wishlistid = req.body.wishlistid
    const index = req.body.index

    console.log(wishlistid + index);
    if (wishlistid) {

        const wishlistData = await wishlist.findById(wishlistid);
        if (wishlistData) {


            wishlistData.productid.splice(index, 1);
            await wishlistData.save();
            res.status(201).json({ success: true })

        }
    }
}
const cartitemspush = async (req, res) => {
    console.log(req.session.ulogin);

    if (req.session.ulogin) {
        const productId = req.body.priductisdata
        const price = req.body.price

        const quantity = req.body.quantity
        const userid = req.session.ulogin
        console.log(productId + ' ' + userid + " " + price);

        try {
            console.log(userid);


            if (userid) {
                let cart = await cartschema.findOne({ userid: userid });

                if (!cart) {
                    res.status(404).json({ success: false, message: 'user not fount' })

                }
                const existingProductIndex = cart.product.findIndex(item => item.productid.toString() === productId);

                if (existingProductIndex > -1) {

                    return res.status(200).json({ success: false })
                } else {

                    cart.product.push({ productid: productId, quantity: quantity, price: price });

                }


                await cart.save();
                console.log('Product added to cart successfully!');


                return res.status(200).json({ success: true })


            }
            else {
                res.redirect('/signin')
            }
        } catch (error) {
            console.error('Error adding product to cart:', error);
        }


    }
    else {
        req.session.login = 'before product select please login :)'
        res.status(200).json({ success: 'notlogind', message: 'user need to login' })
    }
    // const cart=cartschema

}



const cartupdata = async (req, res) => {
    const userid = req.session.ulogin
    const { index, number } = req.body
    console.log(index + '   ' + number)
    const id = req.params.cartid
    console.log(id)


    console.log(userid);

    const usercartdata = await cartschema.findOne({ userid: userid })
    const product = await product_schema.findById(id)
    console.log(product.stock);
    console.log(number);

    if (usercartdata) {
        if (product.stock >= number) {
            usercartdata.product[index].quantity = number;
            const toatlproductaprice = number * usercartdata.product[index].price

            await usercartdata.save()
            const summerytoatal = usercartdata.totalprice
            res.status(200).json({ success: true, message: 'cart updated successfully', totalprice: toatlproductaprice, sumtoatal: summerytoatal })
        }
        else {
            res.status(200).json({ success: false, message: "This is the maximum quantity" })
        }
    }
    // console.log(usercartdata.product[index]);

}

const cartitemdelete = async (req, res) => {
    console.log('got')
    const index = req.body.index
    console.log(index);
    const userid = req.session.ulogin
    const usercartdata = await cartschema.findOne({ userid: userid })

    if (!usercartdata) {
        return res.status(200).json({ success: false, message: "please login before delete" })
    }
    usercartdata.product.splice(index, 1)

    await usercartdata.save()
    res.status(200).json({ success: true })
}
const addaddress = async (req, res) => {

    if (req.session.ulogin) {
        try {
            const userid = req.session.ulogin
            const { fullName, addressLine1, addressLine2, city, state, zipCode, country, phoneNumber, addressType } = req.body
            console.log(phoneNumber + typeof phoneNumber)

            const address = await new address_scema({
                userid: userid,
                fullname: fullName,
                addressline1: addressLine1,
                addressline2: addressLine2,
                city: city,
                state: state,
                zipcode: zipCode,
                country: country,
                phone: phoneNumber,
                addrestype: addressType
            })

            const userdata = await User.findById(userid)
            const ad = await address.save()
            userdata.address.push(ad._id)
            const userdatas = await userdata.save()
            console.log(ad);
            console.log(userdatas);
            res.status(200).json({
                success: true
            })
        } catch (error) {
            console.log('the error in posting address' + error);

        }


    }
    else {
        res.redirect('/signin')
    }
}
async function updatestok(productdata, res) {
    console.log('sdfasdgasfgafg');

    for (const datas of productdata) {
        const product = await product_schema.findById(datas.productid);
        if (product.stock < datas.quantity) {
            console.log('yse');

            return res.status(400).json({ success: false, message: 'Insufficient stock for product |' + product.name + "|" });
        }
        product.stock -= parseInt(datas.quantity);
        await product.save();
    }
}
const placeorder = async (req, res) => {
    const userid = req.session.ulogin;
    const { selectedAddress, paymentmethods, discount, cname } = req.body;

    if (paymentmethods && selectedAddress && userid) {
        try {
            // user's cart and address
            const usercart = await cartschema.findOne({ userid }).populate('product.productid');
            const userdata = await User.findById(userid);
            const selectedaddress = await address_scema.findById(selectedAddress);

            if (selectedaddress.userid.toString() !== userid.toString()) {
                return res.status(400).json({ success: false, message: 'User ID and address do not match' });
            }

            const productdata = usercart.product.map(item => ({
                productid: item.productid._id,
                quantity: item.quantity,
                price: item.productid.price,
                discount: Math.abs(item.price - item.productid.price)
            }));

            // Check product stock
            for (const datas of productdata) {
                const product = await product_schema.findById(datas.productid);

                if (!product) {
                    return res.status(400).json({ success: false, message: `Product with ID ${datas.productid} not found` });
                }

                console.log(`Checking stock for product ID: ${datas.productid} - Stock: ${product.stock}, Requested Quantity: ${datas.quantity}`);
                console.log(product.stock);
                console.log(product.quantity);

                if (product.stock < datas.quantity) {
                    console.log('false');

                    return res.status(400).json({ success: false, message: 'Insufficient stock for product |' + product.name + "|" });
                }
            }

            // Generate unique order ID
            const uniqueString = `${Date.now()}-${Math.random()}`;
            const hash = crypto.createHash('sha256').update(uniqueString).digest('hex');
            const orderId = `ORD-${hash.slice(0, 16).toUpperCase()}`;

            // Create new order


            if (paymentmethods === 'onlinePayment') {
                const order = new orderchema({
                    user: userid,
                    orderid: orderId,
                    products: productdata,
                    totalAmount: Math.floor(usercart.totalprice * 100) / 100,
                    paymentMethod: paymentmethods,
                    shippingAddress: selectedaddress,
                    'coupon.discount': discount,
                    'coupon.couponcode': cname
                });

                const ordersave = await order.save();
                if (ordersave) {
                    userdata.orders.push(ordersave._id);

                    const options = {
                        amount: Math.floor((ordersave.totalAmount * 100) - (ordersave.coupon.discount * 100)),
                        currency: 'INR',
                        receipt: ordersave._id.toString()
                    };

                    const razorpayOrder = await razorpay.orders.create(options);
                    usercart.product = [];
                    await usercart.save();
                    ordersave.razorpay = razorpayOrder.id;
                    await ordersave.save();

                    return res.status(200).json({
                        success: true,
                        order_id: razorpayOrder.id,
                        razorpay: true,
                        amount: options.amount,
                        orderId: ordersave._id
                    });
                }
            } else if (paymentmethods === 'wallet') {
                if (true) {
                    const wallet = await Wallet.findOne({ userId: userid });
                    const total = Math.floor(usercart.totalprice * 100) / 100;

                    if (wallet.balance >= total) {
                        updatestok(productdata, res)
                        const order = new orderchema({
                            user: userid,
                            orderid: orderId,
                            products: productdata,
                            totalAmount: Math.floor(usercart.totalprice * 100) / 100,
                            paymentMethod: paymentmethods,
                            shippingAddress: selectedaddress,
                            'coupon.discount': discount,
                            'coupon.couponcode': cname
                        });

                        const ordersave = await order.save();
                        wallet.transactions.push({
                            type: 'debit',
                            amount: total,
                            date: new Date(),
                            description: 'Purchased'
                        });
                        order.status = 'Processing';
                        order.paymentStatus = 'Paid';
                        const orderda = await order.save();

                        usercart.product = [];
                        await usercart.save();

                        userdata.orders.push(ordersave._id);
                        await userdata.save();

                        wallet.balance -= total;
                        await wallet.save();
                        req.session.orderid = orderda._id


                        return res.status(200).json({ success: true, message: 'The order was successfully placed using Wallet' });
                    } else {
                        return res.status(200).json({ success: false, reason: 'nobalence', message: 'Insufficient balance' });
                    }
                }
            } else {
                const order = new orderchema({
                    user: userid,
                    orderid: orderId,
                    products: productdata,
                    totalAmount: Math.floor(usercart.totalprice * 100) / 100,
                    paymentMethod: paymentmethods,
                    shippingAddress: selectedaddress,
                    'coupon.discount': discount,
                    'coupon.couponcode': cname
                });

                const ordersave = await order.save();
                updatestok(productdata, res)
                usercart.product = [];
                await usercart.save();

                userdata.orders.push(ordersave._id);
                await userdata.save();
                req.session.orderid = ordersave._id
                return res.status(200).json({ success: true, cod: true, message: 'The order was successfully placed' });
            }
        } catch (error) {
            console.error('Error in placing order:', error);
            return res.status(500).json({ success: false, message: 'Error placing order', error: error.message });
        }
    }
}


const deleteaddress = async (req, res) => {
    const id = req.params.id
    const userid = req.session.ulogin
    console.log(id);

    await address_scema.deleteOne({ _id: id })
    const user = await User.findById(userid)
    filteredarray = user.address.filter(addressId => !addressId.equals(id))
    user.address = filteredarray
    // await addresdata.save()
    const data = await user.save()
    data ? res.status(200).json({ success: true }) : res.status(404)


}
const addressave = async (req, res) => {
    console.log(req.body);
    const address = await address_scema.findById(req.body.id)
    Object.assign(address, req.body)
    console.log(address);

    const addresaveed = await address.save()
    console.log('saved' + addresaveed);

    if (addresaveed) {
        return res.status(200).json({ success: true, message: 'address updated' })
    }
}
const cancelorder = async (req, res) => {
    const userid = req.session.ulogin
    const orderid = req.params.id;
    const order = await orderchema.findById(orderid).populate('products.productid');

    if (order.status === 'Pending' || order.status === 'Processing') {
        console.log('in cancelation');

        if (order.paymentStatus == 'Paid') {
            const wallets = await Wallet.findOne({ userId: userid })
            console.log('yes');

            // console.log(wallets);
            const money = (order.totalAmount - order.coupon.discount)

            if (!wallets) {
                userdata = new Wallet({
                    userId: userid,
                    balance: money,
                    transactions: []
                });
                await userdata.save();
                order.status = 'Cancelled';
                await order.save();
                return res.status(200).json({ success: true, message: 'The order is canceled successfully' });
            }
            // console.log(wallets);
            wallets.balance += money
            const dats = order.products.map(item => item.productid.name).join(', ')



            wallets.transactions.push({
                type: 'credit',
                amount: money,
                date: new Date(),
                description: `refund of ${dats}`
            });
            console.log('saved');



            await wallets.save()
        }
        order.status = 'Cancelled';
        await order.save();

        for (const a of order.products) {
            console.log('\n \n' + a + '\n');
            const product = await product_schema.findById(a.productid);
            if (product) {
                product.stock += a.quantity;
                await product.save();
            }
        }

        res.status(200).json({ success: true, message: 'The order is canceled successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Order is not pending and cannot be canceled' });
    }
};

const editname = async (req, res) => {
    const changedname = req.body.ename
    const userid = req.session.ulogin
    const udata = await User.findById(userid)
    udata.name = changedname
    const dataup = await udata.save()
    dataup ? res.status(200).json({ success: true, message: 'username successfully changed' }) : res.state(200).json({ success: false, message: 'there is somthig issue in updateing user name' })
}

const changepass = async (req, res) => {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.session.ulogin)
    if (!user) {
        return res.status(404).json({ message: 'usernot found' })
    }



    if (user.password) {
        console.log(user.password);

        const isvalid = await bcrypt.compare(currentPassword, user.password)
        if (!isvalid) {
            return res.status(401).json({ message: 'Entered incorrrect password' })
        }
    }
    newhshedpass = await bcrypt.hash(newPassword, 10)

    user.password = newhshedpass
    const a = await user.save()
    a ? res.status(200).json({ success: true }) : res, res.status(404)
}
const productstockdata = async (req, res) => {
    const proid = req.params.id
    const productdata = await product_schema.findById(proid)
    console.log(productdata);
    res.status(200).json({ success: true, stock: productdata.stock })

}
const cancelitem = async (req, res) => {
    try {
        console.log(req.body);
        const { orderid, productid } = req.body;

        let orderdata = await orderchema.findOne({ orderid: orderid }).populate('products.productid')
        if (!orderdata) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        console.log(JSON.stringify(orderdata));
        
        const index = orderdata.products.findIndex(product => product._id == productid);
        if (index === -1) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        // Update product status to false
        orderdata.products[index].status = false;

        let percentage = 0;
        let refundprice = 0;

        if (orderdata.coupon && orderdata.coupon.couponcode) {
            console.log('coupon exsist');

            percentage = (orderdata.coupon.discount * 100) / orderdata.totalAmount;
            refundprice = ((orderdata.products[index].price - orderdata.products[index].discount) * orderdata.products[index].quantity)
                - (((orderdata.products[index].price - orderdata.products[index].discount) * percentage / 100)
                    * orderdata.products[index].quantity);
        } else {
            console.log('quantity ' + orderdata.products[index].quantity);
            refundprice = (orderdata.products[index].price - orderdata.products[index].discount) * orderdata.products[index].quantity;
        }

        if(orderdata.paymentStatus=='Paid'){
            const wallet=await Wallet.findOne({userId:orderdata.user})
            wallet.balance += refundprice
        
            wallet.transactions.push({
                type: 'credit',
                amount: refundprice,
                date: new Date(),
                description: `refund of ${orderdata.products[index].productid.name}`
            });
            await wallet.save()
        }
        orderdata.refund = orderdata.refund || 0;
        orderdata.refund += refundprice;
        
        if ((orderdata.totalAmount-orderdata.coupon.discount) - orderdata.refund == 0) {
            console.log('yes');
            orderdata.status = 'Cancelled'

        }
        else {
            console.log('no');

        }
        // const change = true;
        const change = await orderdata.save();
        console.log('Updated refund in database:', change.refund);

        if (change) {
            res.status(201).json({ success: true });
        } else {
            res.status(204).json({ success: false, message: "Refund not processed" });
        }
    } catch (error) {
        console.error("Error processing cancellation:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const patchwishlist = async (req, res) => {
    const productid = req.params.id;
    const userid = req.session.ulogin;

    const wishlistuser = await wishlist.findOne({ userid: userid });

    if (userid) {
        if (!wishlistuser) {
            const cwishlist = new wishlist({
                userid: userid,
                productid: [productid],
            });
            await cwishlist.save();
            return res.status(200).json({ success: true, message: 'Product added to your wishlist.' });
        } else {
            if (wishlistuser.productid.includes(productid)) {
                return res.status(200).json({ success: false, message: 'The product is already in your wishlist.' });
            } else {
                wishlistuser.productid.push(productid);
                await wishlistuser.save();
                return res.status(200).json({ success: true, message: 'Product added to your wishlist.' });
            }
        }
    }
    else {
        return res.status(200).json({ success: 'nologined', message: 'Make sure you logind.' });

    }


};

const coupenapplaying = async (req, res) => {
    const cname = req.params.name
    const coupen = await coupencode.findOne({ code: cname })
    if (!coupen) {
        return res.status(200).json({ success: false, erromsg: 'Entered couponcode is invalid' })
    }
    // const formattedDate = expiryDate.;

    console.log();
    const exdate = coupen.expiryDate.toISOString().split('T')[0]
    const date = new Date().toISOString().split('T')[0]
    console.log(date);
    console.log(exdate);
    if (date >= exdate) {
        return res.status(200).json({ success: false, erromsg: 'The coupon code expaired' })

    }



    const userid = req.session.ulogin

    const cart = await cartschema.findOne({ userid: userid })
    const price = cart.totalprice > coupen.min && cart.totalprice < coupen.max
    console.log(price);
    if (!price) {
        return res.status(200).json({ success: false, erromsg: `The coupon can apply between ${coupen.min} - ${coupen.max} ` })
    }
    const discount = (cart.totalprice * coupen.discount) / 100


    res.status(200).json({ success: true, coupon: coupen.code, discount, toatal: cart.totalprice })


}
const razorpayvarify = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        // Verify the payment signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        console.log(sign);
        console.log(razorpay_signature);

        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAYSCECRET)
            .update(sign)
            .digest("hex");

        if (razorpay_signature === expectedSign) {

            const updatedOrder = await orderchema.findById(orderId);
            const products = updatedOrder.products.map(item => ({
                productid: item.productid._id,
                quantity: item.quantity,
                price: item.productid.price,
                discount: Math.abs(item.price - item.productid.price)
            }))

            updatestok(products, res)
            updatedOrder.status = 'Processing'
            updatedOrder.paymentStatus = 'Paid'
            await updatedOrder.save()
            if (!updatedOrder) {
                throw new Error('Order not found');
            }

            req.session.orderid = orderId


            res.json({
                success: true,
                message: "Payment has been verified",
                order: updatedOrder
            });
        } else {
            console.log('payment error or failed');
            throw new Error('Invalid signature');

        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(400).json({
            success: false,
            message: "Payment verification failed",
            error: error.message
        });
    }
}
const sendreset = async (req, res) => {
    try {
        const { email } = req.body;
        req.session.username = email;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('User not found');
        }


        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = Date.now() + 3600000;


        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = tokenExpiry;
        await user.save();

        // Construct the reset link
        const resetLink = `http://localhost:4050/reset-password/${resetToken}`;

        // Send the reset link to the user's email
        await sendPasswordResetOTP(email, resetLink, user.user_name);

        res.send('Password reset email sent.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error sending reset email.');
    }
};
const resetpage = async (req, res) => {
    const { token } = req.params;

    // Find user by token and check if the token is still valid
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() } // Ensure the token is still valid
    });

    if (!user) {
        return res.status(400).send('Password reset token is invalid or has expired.');
    }

    // Render a form where the user can enter a new password
    res.render('reset-password', { token });
}
const resetpasspost = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // Find the user by token and check if token is valid
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // Ensure token is still valid
        });

        if (!user) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }

        const hashed_pass = await bcrypt.hash(password, 10)

        user.password = hashed_pass;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.redirect('/signin')
    } catch (error) {
        console.error(error);
        res.status(500).send('Error resetting password.');
    }
}
const returning = async (req, res) => {
    const productid = req.params.proid
    console.log(productid);
    const { returnReason, returnDetails, orderid } = req.body
    // console.log(bodydata);
    const orders = await orderchema.findById(orderid)
    console.log(orders);
    const index = orders.products.findIndex(p => p.productid.equals(productid));

    console.log(index);
    orders.products[index].return = "returnreq"
    orders.products[index].returnReason = returnReason
    orders.products[index].returnExplanation = returnDetails

    await orders.save()
    return res.status(200).json({ success: true, message: 'return requst succsesfully done' })

}
const paymentfaied = async (req, res) => {
    console.log(req.params);
    const orderdata = await orderchema.findById(req.params.id)
    console.log(orderdata);
    orderdata.paymentStatus = 'Failed'
    await orderdata.save()


}
const retrypayment = async (req, res) => {
    const id = req.params.id
    const order = await orderchema.findById(id)
    const razorpayid = order.razorpay
    console.log(order);

    console.log(razorpayid + order.totalAmount);
    const total = (order.totalAmount - order.coupon.discount * 100)
    return res.status(200).json({
        success: true,
        order_id: razorpayid,
        razorpay: true,
        amount: total,
        orderId: id
    })
    // res.status(200).json({success:true,datas:razorpayid,,})
}
const invoice = async (req,res) => {
    const orderid = req.params.orderid
    const orderData = await orderchema.findOne({ orderid: orderid }).populate('products.productid')
    console.log(Object.keys(orderData).length );
    console.log(Object.values(orderData) );
    console.log(JSON.stringify(orderData));
    
   
    console.log(JSON.stringify(orderData));
    try {

        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="fgsdfgdf.pdf"');
        doc.pipe(res);
        


        doc.font('Helvetica-Bold').fontSize(16);

        // Invoice Header
        doc.fillColor('#2C3E50')
            .text('INVOICE', { align: 'right' });

        doc.moveDown();

        // Order Details
        doc.font('Helvetica-Bold').fontSize(10)
            .fillColor('#34495E')
            .text(`Invoice Number: ${orderData.orderid}`, { align: 'right' })
            .text(`Date: ${new Date(orderData.orderDate).toLocaleDateString()}`, { align: 'right' });

        doc.moveDown(2);

        // Shipping Information
        doc.font('Helvetica-Bold').fontSize(12)
            .fillColor('#2980B9')
            .text('Shipping Address:', { underline: true });

        doc.font('Helvetica').fontSize(10)
            .fillColor('black')
            .text(`${orderData.shippingAddress.fullname}`)
            .text(`${orderData.shippingAddress.addressline1}`)
            .text(`${orderData.shippingAddress.addressline2}`)
            .text(`${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipcode}`)
            .text(`${orderData.shippingAddress.country}`)
            .text(`Phone: ${orderData.shippingAddress.phone}`);

        doc.moveDown(2);

        // Product Details (Only non-canceled products)
        doc.font('Helvetica-Bold').fontSize(12)
            .fillColor('#2980B9')
            .text('Product Details:', { underline: true });

        // Filter out canceled products
        const activeProduts = orderData.products.filter(product => product.status !== false);

        doc.font('Helvetica').fontSize(10);
        activeProduts.forEach((product, index) => {
            const productDetails = product.productid;

            doc.fillColor('black')
                .text(`${index + 1}. ${productDetails.name}`, { continued: true })
                .fillColor('#7F8C8D')
                .text(`  Qty: ${product.quantity}`, { continued: false })
                .fillColor('black')
                .text(`   Price:${product.price} Rs`, { continued: false })
                .text(`   Discount:${product.discount.toLocaleString()} Rs`)
                .moveDown(1);
        });
        const subtoatal = activeProduts.reduce((acc, product) => {
            return acc + (product.price - product.discount) * product.quantity
        }, 0)
        console.log(subtoatal);

        function coupondiscount() {
            const coupon = (orderData.coupon.discount * 100) / orderData.totalAmount
            return (subtoatal * coupon) / 100

        }
        // Total Amount Calculations
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(12)
            .fillColor('#2980B9')
            .text('Payment Summary:', { underline: true });

        doc.font('Helvetica').fontSize(10)
            .fillColor('black')
            .text(`Subtotal:${subtoatal} Rs`, { align: 'right' })
            .text(`Coupon Discount: ${coupondiscount()} Rs`, { align: 'right' })
            .font('Helvetica-Bold')
            .text(`Total: ${(orderData.totalAmount - orderData.refund - orderData.coupon.discount).toLocaleString()} Rs`, { align: 'right' });


        doc.moveDown();
        doc.font('Helvetica').fontSize(10)
            .fillColor('#34495E')
            .text(`Payment Method: ${orderData.paymentMethod}`, { align: 'center' });

 
        doc.end();



    } catch (error) {
        console.error('Error generating invoice:', error);
    }




}
module.exports = { signup, otpvarify, resent, varifylogin, viewproduct, logout, blockuser, glogincb, cartitemspush, cartupdata, cartitemdelete, addaddress, placeorder, deleteaddress, cancelorder, editname, changepass, productstockdata, cancelitem, patchwishlist, removewish, coupenapplaying, razorpayvarify, sendreset, resetpage, resetpasspost, returning, addressave, paymentfaied, retrypayment, invoice }     