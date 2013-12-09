<?php

	// Yes. this is PHP
	// No. it isn't elegantly written
	// That's because all it does is take a file, push it to S3, and return the resulting URL.
	// STOP JUDGING JUDGE ME
	
	// Load in the S3 magic
	include('conf.php');
	require 'vendor/autoload.php';

	use Aws\Common\Aws;
	use Aws\S3\Exception\S3Exception;

	// Decode the gif
	$image_encoded = $_POST['img'];
	$image_decoded = base64_decode($image_encoded);

	// Store it in a temp file
	$temp = tmpfile();
	$temp = fopen("tmp/temp.gif","w+");
	fwrite($temp, $image_decoded);

	// Instantiate an S3 client
	global $S3_KEY, $S3_SECRET, $S3_BUCKET;
	$aws = Aws::factory(array(
    	'key'    => $S3_KEY,
    	'secret' => $S3_SECRET
	));
	$s3 = $aws->get('s3');

	// Upload a publicly accessible file.
	try {
		// Generate a URL that we can really only hope is unique...
		$guid = uniqid("cinemagif_").".gif";

		// Upload to S3
		$object = $s3->upload($S3_BUCKET, $guid, $temp, 'public-read');

		// Return the URL
		echo('{"url":"'.$object['ObjectURL'].'"}');
	} catch (S3Exception $e) {
		// Something went wrong.  Bummer.
	    echo('{"error":"There was an error uploading the file."}');
	}

?>