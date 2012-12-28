$("body").append("<div id='ezcontactlink' style='border:5px solid blue;position: absolute;top:100px;left:0px;'><a href='#'>Contact Us</a></div>")		
$("body").append("<div id='ezcontact' style='width: 300px;border:5px solid blue;display:none;position:absolute; top: 100px;left: 200px;z-index:1000;background-color:white;'><form><input type='text' name='name' value='nick'><br/><input type='text' name='email_from' value='nmanousos@gmail.com'><br/><textarea name='message'>message goes here</textarea><br/><input type='submit' value='Send'/></form><p style='display:none;'>Email sent, thanks!</p></div>")

$("#ezcontactlink").click(function(){
	$("#ezcontact").toggle();return false;
})

$("#ezcontact form").submit(function(e){
	e.preventDefault();			
	$.getJSON('http://localhost:3000/email'+
		'?name='+$("#ezcontact form input[name='name']").val()+
		'&email_from='+$("#ezcontact form input[name='email_from']").val()+
		'&message='+$("#ezcontact form textarea[name='message']").val()+
		'&shop='+Shopify.shop+
		'&callback=?').done(
		function(response) {
			if(response == 'OK') {
				$("#ezcontact p").show()
				setTimeout(function(){
					$("#ezcontact p").hide()
					$("#ezcontact").toggle()
				},1000		
				)  				
			}
		}
	)
})