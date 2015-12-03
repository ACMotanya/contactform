var request = require('request');

request.post({
	url: 'https://essential-oil.myshopify.com/admin/script_tags.json',
	headers: { "X-Shopify-Access-Token" : "030d4c727c32c17d3f4278593e108c0f"
},
	body: {
		"script_tag": {
			"event": "onload",
			"src": "http://aqueous-thicket-4736.herokuapp.com/js/contactform.js"
		}
},
	json:true
},
	function(req, res){
		console.log(res.body);
});
