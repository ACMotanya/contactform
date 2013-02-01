jQuery("body").append("<div id='ezcontactlink' style='"+
 "-webkit-transform: rotate(-90deg); -moz-transform: rotate(-90deg); -ms-transform: rotate(-90deg); -o-transform: rotate(-90deg);"+
  //"-webkit-transform-origin: 50% 50%;-moz-transform-origin: 50% 50%;-ms-transform-origin: 50% 50%;-o-transform-origin: 50% 50%;transform-origin: 50% 50%;"+
  "filter: progid:DXImageTransform.Microsoft.BasicImage(rotation=3);"+
"border:2px solid black;-moz-border-radius: 3px;border-radius: 3px;background: white;padding: 2px;position:fixed;top:95px;left:-28px;width:75px;height:20px"+
"'><a style='font-family: Helvetica, sans-serif;font-size:14px; color:black;' href='#'>Contact Us</a></div>")		
jQuery("body").append("<div id='ezcontact' style='position:relative; padding:5px; width: 300px;border:5px solid black;-moz-border-radius: 15px;border-radius: 15px;display:none;position:fixed;"+
 "top: 100px;left: 200px;z-index:99999;background-color:white;'><form><input type='text' name='name' placeholder='Your Name Here' style='font-family: Helvetica, sans-serif:font-size: 14px;color:black;'><br/><input type='text' style='font-family: Helvetica, sans-serif:font-size: 14px;color:black;' name='email_from' placeholder='Your Email Here' ><br/>"+
 "<textarea style='width:280px;height:100px; font-family: Helvetica, sans-serif:font-size: 14px;color:black;' name='message' placeholder='Your Message Goes Here'></textarea><br/><input type='submit' value='Send'/></form><p style='display:none;'>Email sent, thanks!</p>"+
 "<a id='ezcontactclose' style='position:absolute;top:5px;right:5px;font-family: Helvetica, sans-serif:font-size: 14px;color:red;' href='#'>Close</a></div>")

jQuery("#ezcontactlink").live("click", function(){
	//console.log("test")
	jQuery("#ezcontact").show();return false;
})
jQuery("#ezcontactclose").live("click", function(){
	//console.log("test1")
	jQuery("#ezcontact").hide();return false;
})


jQuery("#ezcontact form").submit(function(e){
	e.preventDefault();			
	jQuery.get('http://aqueous-thicket-4736.herokuapp.com/email'+
		'?name='+jQuery("#ezcontact form input[name='name']").val()+
		'&email_from='+jQuery("#ezcontact form input[name='email_from']").val()+
		'&message='+jQuery("#ezcontact form textarea[name='message']").val()+
		'&shop='+Shopify.shop)

	jQuery("#ezcontact p").show()
	setTimeout(function(){
		jQuery("#ezcontact p").hide()
		jQuery("#ezcontact").toggle()
	},1000)  				


})