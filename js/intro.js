$(function() {
	var $cinemagraph = $("#cinemagraph");
	$("#frame1").show();
	$("#frame1-start").click(function() {
		$("#frame1").hide();
		$cinemagraph.Cinemagraph();
	});

	$("#frame1-more").click(function() {
		$("#frame1").hide();
		$("#frame2").show();
	});
});