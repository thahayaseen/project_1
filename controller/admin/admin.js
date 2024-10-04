const User = require('../../model/user_scema')
const Product = require('../../model/product_schema');
const bcrypt = require('bcrypt')
const path = require('path');
const fs = require('fs');
const categories = require('../../model/categories');
const { check } = require('express-validator');

// admin authentication 
const auth = async (req, res, next) => {
    try {
        const { username, password } = req.body


        const exsist = await User.findOne({ user_name: username })
        if (!exsist) {
            return res.redirect('/admin')
        }
        const adminverigfy = bcrypt.compare(password,exsist.password)

        if (!adminverigfy) {
            return res.redirect('/admin')
        }

        if (!exsist.isadmin) {
            return res.redirect('/admin')
        }
        if(exsist.isadmin===true){
            req.session.ladmin = true
            return res.redirect('/admin/dashbord')

        }



       

    } catch (error) {
        console.log(error);

    }


}


// admin side user block and unblock 
const accses = async (req, res, next) => {
    try {
        const user_id = req.params.id
        console.log(user_id + 'userid');

        const detials = await User.findById(user_id)
        if (!detials) {
            return res.status(404).json({ message: 'user not found' })
        }
        detials.blocked = !detials.blocked
        await detials.save()

        res.status(200).json({
            success: true,
            udata: detials.blocked,
            message: 'user status updated successfully'
        })

    }
    catch (error) {
        console.log(error);

    }
}



const list = async (req, res, next) => {
    try {
        const id = req.params.id;

        // Find the product by ID
        const product = await Product.findById(id);

        // Check if the product exists
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.unlist = !product.unlist;

        // Save the updated product list
        await product.save();

        // Return success response with the updated status
        return res.status(200).json({
            success: true,
            newStatus: product.unlist,
            message: `Product ${product.unlist ? 'listed' : 'unlisted'} successfully.`,
        });
    } catch (error) {
        console.error('Error updating product status:', error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};
//add product
const padd = async (req, res, next) => {
    const { newProductName, newProductCategory, newProductDescription, newProductPrice, newProductStock } = req.body
    const fiels = req.files
    console.log(fiels);
    let image = []
    fiels.forEach(num => {
        image.push(num.filename)
    })
    console.log(image);
    console.log(newProductCategory);

    const newProduct = new Product({
        name: newProductName,
        category_id: newProductCategory,
        description: newProductDescription,
        price: newProductPrice,
        stock: newProductStock,
        images: image

    });
    image = []
    await newProduct.save()

    res.status(200).json({ success: true })

}
const submitedit = async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    const { productName, productCategory, productDescription, productStock, productPrice } = req.body;

    if (productName && productCategory && productDescription && productStock && productPrice) {
        product.name = productName;
        product.category_id = productCategory;
        product.description = productDescription;
        product.stock = productStock;
        product.price = productPrice;
        product.save()
        return res.status(200).json({ success: true })
    }

}

const imageadding = async function updateProduct(req, res) {
    const productId = req.params.id;

    try {
        const files = req.files; // Get uploaded files (new images)
        const croppedImages = req.body.croppedImages ? JSON.parse(req.body.croppedImages) : []; // Get cropped image data
        const deletedImages = req.body.deletedImages ? JSON.parse(req.body.deletedImages) : []; // Parse deleted images

        // Find the product by ID
        const product = await Product.findById(productId);

        // Handle new uploaded files (add new images)
        if (files && files.length > 0) {
            files.forEach(file => {
                if (!product.images.includes(file.filename)) { // Check if the image is not already in the product's image array
                    product.images.push(file.filename); // Push the new image filenames into the array
                }
            });
        }

        // Handle cropped images
        if (croppedImages.length > 0) {
            for (const croppedImage of croppedImages) {
                const { base64, name } = croppedImage;

                // Convert base64 image data to a buffer
                const buffer = Buffer.from(base64, 'base64');

                // Define the upload path and save the cropped image
                const uploadPath = path.join(__dirname, '..', '..', 'public', 'uploads', name);

                // Save the cropped image using sharp (you can adjust dimensions as needed)
                await sharp(buffer)
                    .resize(300, 300) // Resize or crop (adjust as needed)
                    .toFile(uploadPath);

                // Add the cropped image to the product's images array
                product.images.push(name);
            }
        }
        // Remove deleted images from the product's image array
        if (deletedImages.length > 0) {
            product.images = product.images.filter(image => !deletedImages.includes(image));

            // Delete the images from the server's file system
            deletedImages.forEach(image => {
                const imagePath = path.join(__dirname, '..', '..', 'public', 'uploads', image);
                fs.unlink(imagePath, (err) => {
                    if (err) {
                        console.error(`Failed to delete image file: ${imagePath}`);
                    }
                });
            });
        }

        // Save the updated product to the database
        await product.save();

        // Send a success response
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, message: 'Failed to update product.' });
    }
}
// dave categories 
const savecat = async (req, res) => {
    try {
        const { newCategoryName, newProductDescription } = req.body
        const newcategories = new categories({
            name: newCategoryName,
            description: newProductDescription
        })
        await newcategories.save()
        // console.log(req.body);

        res.status(200).json({ success: true })
    } catch (error) {
        console.log('in save categosy rout' + error);

    }
}

const useredit = async (req, res, next) => {
    const { CategoryName, ProductDescription } = req.body

    const catid = req.params.id
    // console.log(catid);
    const category = await categories.findById(catid)

    category.name = CategoryName
    category.description = ProductDescription

    await category.save()

    res.status(200).json({ success: true })

}
const categoryunlist = async (req, res, next) => {

    try {

        const catid = req.params.id
        // console.log(catid);
        const catagory = await categories.findById(catid)
        catagory.list = !catagory.list
        console.log(catagory);

        await catagory.save()


        res.status(200).json({ success: true })
    } catch (error) {
        console.log('error in delete route' + error);

    }

}
module.exports = { auth, accses, list, padd, imageadding, submitedit, savecat, useredit, categoryunlist }