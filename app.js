var express = require('express')
  , partials = require('express-partials')
  , app = express()
  , http = require('http')
  , path = require('path')
  , request = require('request')
	, SendGrid = require('sendgrid').SendGrid
	, sendgrid = new SendGrid(process.env.SENDGRID_USER, process.env.SENDGRID_PW)
	, mongodb = require('mongodb')
	, db = new mongodb.Db(process.env.DB_NAME, new mongodb.Server(process.env.DB_SERVER, Number(process.env.DB_PORT)), {w:0} )		
	, SHOPIFY_KEY = process.env.SHOPIFY_KEY
	, SHOPIFY_SECRET = process.env.SHOPIFY_SECRET
	, PRICE = ( process.env.PRICE ? process.env.PRICE : "1.00" )

db.open(function (err, db_p) { 
	db.authenticate( process.env.DB_USER,  process.env.DB_PW, function(err, res){ 
		if(err) log.log(res) 
	})
})

app.configure(function(){
  app.set('port', process.env.PORT || 3000)
  app.set('views', __dirname + '/views')
  app.set('view engine', 'ejs')
  app.set('jsonp callback', true )
  app.use(partials())
  app.use(express.favicon())
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(express.cookieParser(process.env.COOKIE))
  app.use(express.session())
  app.use(app.router)
  app.use(express.static(path.join(__dirname, 'public')))
})

var server = http.createServer(app).listen(app.get('port'), function(){ console.log("go!") })

app.get('/', function(req, res) {

	if(req.query["shop"] && !req.query['code']) {
		res.redirect('https://'+req.query["shop"]+'/admin/oauth/authorize?client_id='+SHOPIFY_KEY+'&scope=read_script_tags,write_script_tags')
	} else if(req.query["shop"] && req.query['code']) {		
		request.post({
			url: 'https://'+req.query["shop"]+'/admin/oauth/access_token?client_id='+SHOPIFY_KEY+'&client_secret='+SHOPIFY_SECRET+'&code='+req.query["code"]
			, json: true
			}, function(req0, res0){
				console.log(res0.body)	
				
				request.get({
					url: 'https://'+req.query["shop"]+'/admin/shop.json'
					, headers: { "X-Shopify-Access-Token" : res0.body["access_token"] }
					, json:true
					}, function(req1, res1){
					
						res1.body.shop.access_token = res0.body["access_token"]					
						db.collection(req.query["shop"]+"_config", function(err, shop_config) {
							shop_config.insert(res1.body.shop)
						})						

						request.post({
							url: 'https://'+req.query["shop"]+'/admin/script_tags.json'
							, headers: { "X-Shopify-Access-Token" : res0.body["access_token"] }
							, body: {
								"script_tag": {
									"event": "onload",
									"src": "http://aqueous-thicket-4736.herokuapp.com/js/contactform.js"
								}
							}
							, json:true
							}, function(req2, res2){
								console.log(res2.body)					
								res.render("index",{ locals:{installed:true}})
						})					


				})
			}
		)
	} else {
		res.render("index")
	}

})

app.get('/email', function(req, res) {

	console.log(req.query['name'])
	console.log(req.query['email_from'])
	console.log(req.query['message'])
	console.log(req.query['shop'])

	db.collection(req.query['shop']+"_config", function(err, shop_config) {
		shop_config.findOne({myshopify_domain: req.query['shop']}, function(err, shop) {
			if(shop) {
			
				sendgrid.send({
					to: shop.email,
					from: req.query['email_from'],
					fromname: req.query['name'],
					subject: 'Message from your contact form',
					text: req.query['message']
				}, function(success, message) {
					if (!success) {
						console.log(message);
						res.jsonp('ERROR')
					} else {
						res.jsonp('OK')
					}
				});

			}
		})
	})

});