//These are all your config variables
var express = require('express')
  , partials = require('express-partials')
  , app = express()
  , http = require('http')
  , path = require('path')
  , async = require('async')
  , request = require('request')
	, SendGrid = require('sendgrid').SendGrid
	, sendgrid = new SendGrid(process.env.SENDGRID_USER, process.env.SENDGRID_PW)
	, mongodb = require('mongodb')
	, db = new mongodb.Db('contactform', new mongodb.Server(process.env.DB_SERVER, Number(process.env.DB_PORT)), {w:0} )		
	//environment variables are variable that are declared outside of the code. usually for security reasons
	//it's useful to name them always in capitals so that they are easy to distinguish from local variables
	, SHOPIFY_KEY = process.env.SHOPIFY_KEY
	, SHOPIFY_SECRET = process.env.SHOPIFY_SECRET
	, domain = ( process.env.NODE_ENV ? 'http://aqueous-thicket-4736.herokuapp.com' : 'http://76.105.146.159:3000' )	
	, internal_domain = ( process.env.NODE_ENV ? 'http://aqueous-thicket-4736.herokuapp.com' : 'http://localhost:3000' )	
	, PROD_MODE = ( process.env.NODE_ENV ? true : false )	
	//the PRICE variable defaults to "1.00" if no environment variable is available. setting PRICE to 0.00 puts the app into free mode
	, PRICE = ( process.env.PRICE ? process.env.PRICE : "1.00" )
console.log('PROD_MODE:'+ 'PROD_MODE')
//initialize the database connection
db.open(function (err, db_p) { 
	db.authenticate( process.env.DB_USER,  process.env.DB_PW, function(err, res){ 
		if(err) console.log('db err: ' + res)
	})
})

//configure express, a module which handles all the web requests
app.configure(function(){
	//localhost will use port 3000, production uses the PORT environment variable
  app.set('port', process.env.PORT || 3000)
  app.set('views', __dirname + '/views')
  //set the view engine to use EJS template files
  app.set('view engine', 'ejs')
  //JSONP enables us to make an AJAX call from javascript stored on other domains to this server
  app.set('jsonp callback', true )
  app.use(partials())
  app.use(express.favicon())
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(express.cookieParser(process.env.COOKIE))
  app.use(app.router)
  app.use(express.static(path.join(__dirname, 'public')))
})

//This line starts the server
var server = http.createServer(app).listen(app.get('port'), function(){ console.log("go!") })

app.get('/', function(req, res) {
	//shop parameter is present, but not the code param. this means that the user is initiating the installation
	if(req.query["shop"] && !req.query['code']) {
		//we redirect them to a page where they either confirm or cancel the installation. confirming it redirects them back to this page, but with a code param
		res.redirect('https://'+req.query["shop"]+'/admin/oauth/authorize?client_id='+SHOPIFY_KEY+'&scope=read_script_tags,write_script_tags')
	//the user has now confirmed the installation, time to start the installation process
	} else if(req.query["shop"] && req.query['code']) {		
		
		var shop = new Object()
		shop.myshopify_domain = req.query["shop"]
		
		//using the async module to help do a waterfall control flow
		//it makes the code a bit easier to read and understand, rather than having a lot of nested callbacks
		async.waterfall([
			function(callback){
				console.log(shop)			
				getAccessToken(shop, req.query['code'], function(err, data) {
					shop.access_token = data
					callback(null, shop)
				})
			},
			function(shop, callback){
				console.log(shop)			
				getShopInfo(shop, function(err, data){
					var temp_access_token = shop.access_token
					shop = data
					shop.access_token = temp_access_token
					callback(null, shop)
				})
			},
			function(shop, callback){
				console.log(shop)			
				//I set this disabled flag here since they haven't paid yet. Once we have confirmed they paid we remove it and install the contact form tab
				//notice it is only set if the PRICE variable is not '0.00' (free)
				if(PRICE != '0.00') shop.disabled = true						
				db.collection(req.query["shop"]+"_config", function(err, shop_config) {
					shop_config.insert(shop, function(err, data) {
						console.log('err: ' + err + ' data: ' + data)
						callback(null, shop)
					})
				})
			}
		], function (err, result) {
			console.log('waterfall done!')
			console.log(result)
			if(PRICE != '0.00') {
				console.log('not in free mode, creating charge')
				//app is in charge mode so create an app charge
				createOneTimeCharge(shop, function(err, data){
					//redirect the user to confirm the app charge
					res.redirect(data)
				})			 
			} else {
				console.log('app is in free mode')			
				//app is in free mode so just install script and go straight to the index page
				installScriptTag(shop, function(err, data) {
					res.render("index",{ locals:{installed:true}})
				})
			}
		})
		
	} else {
		res.render("index")
	}

})

app.get('/application_charges', function(req, res) {
	console.log('/application_charges')
	console.log(req.query)

	async.waterfall([
		function(callback){
			db.collection(req.query["shop"]+"_config", function(err, shop_config) {
				shop_config.findOne({"myshopify_domain": req.query["shop"]}, function(err, shop){
					callback(null, shop, shop_config)				
				})
			})			
		},
		function(shop, shop_config, callback){
			getOneTimeChargeStatus(shop, req.query["charge_id"], function(err, chargeAccepted){
				console.log('chargeAccepted: ' + chargeAccepted)
				if(chargeAccepted) {
					console.log('charge is accepted so lets continue')
					callback(null, shop, shop_config)
				} else {
					console.log('charge is not accepted so create a new one and redirect them back to it')
					createOneTimeCharge(shop, function(err, data){
						//redirect the user to confirm the app charge
						res.redirect(data)
					})
				}
			})
		},
		function(shop, shop_config, callback){
			activateOneTimeCharge(shop, req.query["charge_id"], function(err, data){
				console.log(data)
				callback(null, shop, shop_config)
			})
		},
		function(shop, shop_config, callback){
			shop_config.update({"myshopify_domain": shop.myshopify_domain}, { $unset: {"disabled": 1} }, {upsert:true}, function(err, data){
				console.log(data)
				callback(null, shop, shop_config);
			})
		},
		function(shop, shop_config, callback){
			installScriptTag(shop, function(err, shop) {		
				callback(null, shop)
			})
		}
	], function (err, result) {
		 console.log('done with application_charge!')
		 res.render("index",{ locals:{installed:true}})
	})
		
})

app.get('/email', function(req, res) {

	console.log(req.query['name'])
	console.log(req.query['email_from'])
	console.log(req.query['message'])
	console.log(req.query['shop'])

	//look up the shop's email from the database
	db.collection(req.query['shop']+"_config", function(err, shop_config) {
		shop_config.findOne({myshopify_domain: req.query['shop']}, function(err, shop) {
			if(shop) {
				sendgrid.send({
					//this should eventually be changed to use the shop.customer_email variable if it is present.
					to: shop.email,
					from: req.query['email_from'],
					fromname: req.query['name'],
					subject: 'Message from your contact form',
					text: req.query['message']
				}, function(success, message) {
					if (!success) {
						console.log(message);
						//sending JSONP responses back - cross domain
						res.jsonp('ERROR')
					} else {
						res.jsonp('OK')
					}
				})
			} else {
				//need to handle the error case here - this happens if the shop is not found in the database.
			}
		})
	})

});

function installScriptTag(shop, callback){
	console.log('installScriptTag:')
	console.log('https://'+shop.myshopify_domain+'/admin/script_tags.json')
	request.post({
		url: 'https://'+shop.myshopify_domain+'/admin/script_tags.json'
		, headers: { "X-Shopify-Access-Token" : shop.access_token }
		, body: {
			"script_tag": {
				"event": "onload",
				//if you change the heroku domain, make sure to update it here as well
				"src": "http://aqueous-thicket-4736.herokuapp.com/js/contactform.js"
			}
		}
		, json:true
		}, function(req, res){
			//this line shows the response from the Shopify API
			console.log('response from installScriptTag:')
			console.log(res.body)
			//eventually there should be real error-checking here, doing a callback(null) 
			//in the meantime which assumes there was no error installing the scriptTags
			callback(null, res.body)
	})	
}

function getShopInfo(shop, callback) {
	console.log('getShopInfo:')
	console.log('https://'+shop.myshopify_domain+'/admin/shop.json')
	request.get({
		url: 'https://'+shop.myshopify_domain+'/admin/shop.json'
		, headers: { "X-Shopify-Access-Token" : shop.access_token }
		, json:true
		}, function(req, res){
			console.log(res.body["shop"])
			//in node.js, errors are always first in the callback. it's not required but is a good coding style to go by
			//we callback with null as the error since there is no error to report (we eventually should do error checking here)
			callback(null, res.body["shop"])
		}
	)
}

function getAccessToken(shop, code, callback){
	console.log('getAccessToken:')
	console.log('https://'+shop.myshopify_domain+'/admin/oauth/access_token?client_id='+SHOPIFY_KEY+'&client_secret='+SHOPIFY_SECRET+'&code='+code)
	request.post({
		url: 'https://'+shop.myshopify_domain+'/admin/oauth/access_token?client_id='+SHOPIFY_KEY+'&client_secret='+SHOPIFY_SECRET+'&code='+code
		, json: true
		}, function(req, res){
			console.log(res.body["access_token"])
			callback(null, res.body["access_token"])
		}
	)
}

function createOneTimeCharge(shop, callback){
	console.log('createOneTimeCharge:')
	console.log('https://'+shop.myshopify_domain+'/admin/application_charges.json')
	request.post({
			url: 'https://'+shop.myshopify_domain+'/admin/application_charges.json'
			, headers: { "X-Shopify-Access-Token" : shop.access_token }
			, body: {
				"application_charge": {
					"name": "Contact Form",
					"price": PRICE,
					"return_url": internal_domain+"/application_charges?shop="+shop.myshopify_domain,
					"test": !PROD_MODE							
				}			
			}
			, json:true
		}, function(req, res){
			console.log(res.body)
			console.log('created charge, redirect URL: ' + res.body.application_charge.confirmation_url)
			callback(null, res.body.application_charge.confirmation_url)
		}
	)

}

function getOneTimeChargeStatus(shop, charge_id, callback){
	console.log('getOneTimeChargeStatus')
	console.log('https://'+shop.myshopify_domain+'/admin/application_charges/'+charge_id+'.json')
	request.get({
			url: 'https://'+shop.myshopify_domain+'/admin/application_charges/'+charge_id+'.json'
			, headers: { "X-Shopify-Access-Token" : shop.access_token }
			, json:true
		}, function(req, res){
			console.log(res.body)
			if(res.body['application_charge'].status == 'accepted') {
				callback(null, true)
			} else {
				callback(null, false)			
			}
		}
	)
}

function activateOneTimeCharge(shop, charge_id, callback){
	console.log('activateOneTimeCharge')
	request.post({
			url: 'https://'+shop.myshopify_domain+'/admin/application_charges/'+charge_id+'/activate.json'
			, headers: { "X-Shopify-Access-Token" : shop.access_token }
			, json:true
		}, function(req, res){
			console.log(res.headers.status)
			callback(null, res.headers.status)
		}
	)
}