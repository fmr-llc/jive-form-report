var placeID;
var tags;
var export_text;
var export_row;
var number_forms;
var tally_categories = false;

/*
 * Jive AJAX return packets will all have a first line that makes it an invalid JSON packet.  This must be stripped off.
 */
jQuery.ajaxSetup({
	dataFilter: function(data, type) {
		return type === 'json' ? jQuery.trim(data.replace(/^throw [^;]*;/, '')) : data;
	}
});


/*
 * Prototype the trim function for IE8 compatibility
 */
if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, ''); 
  }
}

/*
 * string numeric pad function to make formatting time easier.
 */
function pad (str, max) { 
  str = str.toString(); 
  return str.length < max ? pad("0" + str, max) : str; 
}

function format_category(category) {
	var newCat = category.replace(/\//g, '');
	newCat = newCat.replace(/ /g, '');
	return newCat
}
/*
 * Toggle the table gridlines on or off
 */
function toggle_gridlines() {
	if ( $j('#button_gridlines').text() == 'Grid On' ) {
		$j('td').addClass('gridOn');
		$j('#button_gridlines').text('Grid Off');
	} else {
		$j('td').removeClass('gridOn');
		$j('#button_gridlines').text('Grid On');
	}
	resizeMe();
}

/*
 * Update the totals
 */
function tally_totals() {
	// Total each tally field = tally / form count * 100
	$j("._form_report_tally_field").each( function(index) {
		if ( parseInt($j('#report_form_count').text()) == 0 ) {
			$j('#' + this.id + '-total').text( '0%');
			$j('#report_total2 #' + this.id).text( '0%');
		} else {
			$j('#' + this.id + '-total').text( Math.round( ( parseInt($j('#' + this.id).text()) / parseInt($j('#report_form_count').text()) ) * 100) + '%');
			$j('#report_total2 #' + this.id).text( Math.round( ( parseInt($j('#' + this.id).text()) / parseInt($j('#report_form_count').text()) ) * 100) + '%');
		}
	}); 
} 

/*
 * Parse the form and update the report totals for tallyable fields
 */
function tally_form(form) { 
	number_forms += 1;
	var html = form.content.text;
	// Tally each score field on the form
	$j(".__score p", html).each( function(index) {
		$j('#' + this.className).text( parseInt($j('#' + this.className).text()) + 1);
	});
	// Increment the form count
	$j('#report_form_count').text( number_forms );

	// Create a blank export row
	if (number_forms % 2 == 0) {
		$j('#report_row').html( '<tr class="evenrow">' + export_row );
	} else {
		$j('#report_row').html( '<tr>' + export_row );
	}
	var cur_row = $j('#report_row');
	$j('#_form_number', cur_row).text( number_forms );
	// Loop through all reportable fields on the form
	$j('._form_reportable', html).each( function(index, report_field) {
		var textareaid = $j(report_field).children('span[class^="textarea"]').attr('class');
		if ( textareaid != undefined){
			$j('#' + textareaid, cur_row).text( $j(this).text() );
		} else {
			var tally = $j(report_field).hasClass('_form_tallyable');
			// Loop through all paragraphs in the reprtable field
			$j('p', report_field).each( function(index, param) {
				// Update the cooresponding column with the data
				if (tally) {
					$j('#' + $j(this).attr('class'), cur_row).text( "1" );
					$j('#report_total1 #' + $j(this).attr('class')).html( parseInt($j('#report_total1 #' + $j(this).attr('class')).html()) + 1 );
				} else {
					$j('#' + $j(this).attr('class'), cur_row).text( $j(this).text() );
				}
			});
		}
	});

	if (tally_categories) {
		var formattedCat;
		for (var cat = 0; cat < form.categories.length; cat++) {
			formattedCat = format_category(form.categories[cat]);
			$j('#category-' + formattedCat).text( parseInt($j('#category-' + formattedCat).text()) + 1);
			$j('#category-' + formattedCat, cur_row).text( "1" );
			$j('#report_total1 #category-' + formattedCat).html( parseInt($j('#report_total1 #category-' + formattedCat).html()) + 1 );
		}
	}

	//write the row for the export
	export_text += 	$j('#report_row').html();
} 

function export_results() {
	$j('#report_export').show();
	$j('#export_results').hide();
	$j('#hide_export').show();
	if (document.selection) {
		var range = document.body.createTextRange();
		range.moveToElementText(document.getElementById('report_export'));
		range.select();
	} else if (window.getSelection) {
		var range = document.createRange();
		range.selectNodeContents(document.getElementById('report_export'));
		window.getSelection().removeAllRanges();
		window.getSelection().addRange(range);
	}
	resizeMe();
}

function hide_export() {
	$j('#report_export').hide();
	$j('#hide_export').hide();
	$j('#export_results').show();
	resizeMe();
}

/*
 * Find all documents matching the form destination and tags
 */
function tally_forms(startIndex) {
	if (startIndex === undefined || startIndex == 0) {
		startIndex = 0;
		number_forms = 0;
		$j('._form_report_tally_field').html('0');
		$j('._form_report_tally_total').html('0%');
		$j('#report_form_count').html('0');
		$j('#report_date').html('<b>Calculating Form Report...</b>');
	}
	var url = '/api/core/v3/search/contents?filter=type(document)&filter=place(/places/' + placeID + ')&filter=search(' + tags + ')&sort=updatedAsc&count=25&startIndex=' + startIndex;

	$j.ajax({
		type: "GET",
		url: url,
		dataType: "json",
		success: function (data) {
			// Tally each form
			$j(data.list).each(function(index, opt){ 
				// Only process documents that contain the desired tag
				// Temp code to check for TAG.  This needs to be more robust to check multiple tags and such
				if ( opt.tags[0] != undefined ) {
					if ( opt.tags[0].toLowerCase() == tags.toLowerCase() ) {
						tally_form(opt);
					}
				}
			});

			// If # results < 25 then we are finished, otherwise adjust the start var to make the next call
			if (data.list.length < 25) {
				// Tally the totals
				tally_totals();
				export_text += $j('#report_total1').html() + $j('#report_total2').html() + '</table>';
				$j('#report_export').html( export_text );
				//Fill in the current date
				var currentdate = new Date(); 
				var formatted_date = pad((currentdate.getMonth()+1),2) + '/' + pad(currentdate.getDate(),2) + '/' + currentdate.getFullYear() + ' - ' + pad(currentdate.getHours(),2) + ':' + pad(currentdate.getMinutes(),2) + ':' + pad(currentdate.getSeconds(),2); 
				$j('#report_date').html('Date: ' + formatted_date);
				resizeMe();
			} else {
				startIndex += data.list.length;
				tally_forms(startIndex);
			}
		},
		error: function (xhr, ajaxOptions, thrownError){
			alert("tally forms Error: " + thrownError + "\n\nNotify your administrator that this report cannot be generated for place " + placeID + " and tags " + tags + '\nurl: ' + url);
			return false;
		},
		complete: function(){
		}
	});
}

/*
 * Read through the design and build the report fields.
 */
function setup_report(design) { 
	// Fill in the title of the form
	$j('#report_title').html( 'Report: ' + design.form_name );

	// Loop through all form elements and set up the report
	var elemHTML = '';
	var header1 = '<th rowspan="2">#</th>';
	var header2 = '';
	export_text = '<table id="form_report_export">';
	export_row = '<td id="_form_number">0</td>';
	var export_total1 = '<tr class="_form_report_total"><td></td>';
	var export_total2 = '<tr class="_form_report_total"><td></td>';

	// Loop through all form elements
	for (elem = 0; elem < design.form_elements.length; elem++ ) {
		if (design.form_elements[elem].type == "radio"
			|| design.form_elements[elem].type == "checkbox"
 			|| design.form_elements[elem].type == "singleselect"
 			|| design.form_elements[elem].type == "multiselect") {
			header1 += '<th colspan=' + design.form_elements[elem].options.length + '>' + design.form_elements[elem].label + '</th>';
			//build the reort table for the tallable item
			var rows = 0;
			elemHTML += '<table id="' + design.form_elements[elem].id + '" style="width: 100%;">';
			elemHTML += '<tr><th>' + design.form_elements[elem].label + '</th><th>Number of Responses</th><th>% of Total</th></tr>'
			for (opt = 0; opt < design.form_elements[elem].options.length; opt++ ) {
				header2 += '<th>' + design.form_elements[elem].options[opt].value + '</th>';
				export_row += '<td id="' + design.form_elements[elem].options[opt].id + '"></td>';
				export_total1 += '<td id="' + design.form_elements[elem].options[opt].id + '">0</td>';
				export_total2 += '<td id="' + design.form_elements[elem].options[opt].id + '"></td>';
				rows += 1;
				elemHTML += '<tr';
				if (rows % 2 == 0) {
					elemHTML += ' class="evenrow"';
				}
				elemHTML += '><td>' + design.form_elements[elem].options[opt].value + '</td><td id="' + design.form_elements[elem].options[opt].id + '" class="_form_report_tally_field">0</td><td id="' + design.form_elements[elem].options[opt].id + '-total" class="_form_report_tally_total">0%</td></tr>';
			}
			elemHTML += '</table>';
		} else if ( design.form_elements[elem].type == "submitter" ||
					design.form_elements[elem].type == "personselector") {
			var opts = 0;
			if (design.form_elements[elem].option_id == 'Y') {
				opts += 1;
				header2 += '<th>Username</th>';
				export_row += '<td id="' + design.form_elements[elem].id + '-id"></td>';
				export_total1 += '<td></td>';
				export_total2 += '<td></td>';
			}
			if (design.form_elements[elem].option_name == 'Y') {
				opts += 1;
				header2 += '<th>Name</th>';
				export_row += '<td id="' + design.form_elements[elem].id + '-name"></td>';
				export_total1 += '<td></td>';
				export_total2 += '<td></td>';
			}
			if (design.form_elements[elem].option_name == 'Y') {
				opts += 1;
				header2 += '<th>Title</th>';
				export_row += '<td id="' + design.form_elements[elem].id + '-title"></td>';
				export_total1 += '<td></td>';
				export_total2 += '<td></td>';
			}
			if (design.form_elements[elem].option_name == 'Y') {
				opts += 1;
				header2 += '<th>BU</th>';
				export_row += '<td id="' + design.form_elements[elem].id + '-bu"></td>';
				export_total1 += '<td></td>';
				export_total2 += '<td></td>';
			}
			if (design.form_elements[elem].option_name == 'Y') {
				opts += 1;
				header2 += '<th>Email</th>';
				export_row += '<td id="' + design.form_elements[elem].id + '-email"></td>';
				export_total1 += '<td></td>';
				export_total2 += '<td></td>';
			}
			if (design.form_elements[elem].option_name == 'Y') {
				opts += 1;
				header2 += '<th>Phone</th>';
				export_row += '<td id="' + design.form_elements[elem].id + '-phone"></td>';
				export_total1 += '<td></td>';
				export_total2 += '<td></td>';
			}
			header1 += '<th colspan="' + opts + '">' + design.form_elements[elem].label + '</th>';
		} else  if ( design.form_elements[elem].type != "textblock" ){
			header1 += '<th rowspan="2">' + design.form_elements[elem].label + '</th>';
			export_row += '<td id="' + design.form_elements[elem].id + '"></td>';
			export_total1 += '<td></td>';
			export_total2 += '<td></td>';
		}
	} 

	// Check for selectable Category
	if (design.destination.category_type == 'single' ||
		design.destination.category_type == 'multiple') {

		tally_categories = true;
		// Look up the categories for the destination.
		$j.ajax({
			type: "GET",
			url: '/api/core/v3/places/' + design.destination.id + '/categories',
			dataType: "json",
			async: false,
			success: function (data) {
				if(data.list.length){
					header1 += '<th colspan=' + data.list.length + '>Categories</th>';
					//build the reort table for the categories
					var rows = 0;
					var cat = '';
					elemHTML += '<table id="category1" style="width: 100%;">';
					elemHTML += '<tr><th>Category</th><th>Number of Responses</th><th>% of Total</th></tr>'
					for (opt = 0; opt < data.list.length; opt++ ) {
						cat = format_category(data.list[opt].name);
						header2 += '<th>' + cat + '</th>';
						export_row += '<td id="category-' + cat + '"></td>';
						export_total1 += '<td id="category-' + cat + '">0</td>';
						export_total2 += '<td id="category-' + cat + '"></td>';
						rows += 1;
						elemHTML += '<tr';
						if (rows % 2 == 0) {
							elemHTML += ' class="evenrow"';
						}
						elemHTML += '><td>' + data.list[opt].name.trim() + '</td><td id="category-' + cat + '" class="_form_report_tally_field">0</td><td id="category-' + cat + '-total" class="_form_report_tally_total">0%</td></tr>';
					}
					elemHTML += '</table>';
				}
			},
			error: function (xhr, ajaxOptions, thrownError){
				alert( 'error: ' + thrownError);
			},
			complete: function(){
			}
		});
	}

	$j('#report_elements').html(elemHTML);
	export_text += '<tr>' + header1 + '</tr>';
	export_text += '<tr>' + header2 + '</tr>';
	export_row += '</tr>';
	$j('#report_total1').html(export_total1 + '</tr>');
	$j('#report_total2').html(export_total2 + '</tr>');
	// Find all reports submitted for the form design and tally the scores
	placeID = design.destination.id;
	tags = design.tags
	tally_forms(0);
}

/*
 * Look up the form design
 */
function refresh_page() {
	$j.ajax({ 
		type: 'GET', 
		url: '/api/core/v3/contents/' + designID,
		dataType: 'json', 
		success: function (loaded_doc) {
			$j('#report_owner').text('Owner: ' + loaded_doc.author.displayName);
			// The design is inside a span tag in the document content text field.  We have to parse it out...
			var design = $j('*:not(:has("*"))', loaded_doc.content.text).text().trim();
			var json;
			try {
				json = $j.parseJSON(design);
			} catch (error) {
				alert("Parse error: " + error + "\n\nNotify your administrator that the following design is invalid:\n" + design);
				return false;
			};
			try {
				setup_report(json);
			} catch (error) {
				alert("Setup error: " + error + "\n\nNotify your administrator that the following design is invalid:\n" + design);
				return false;
			};
			resizeMe();
		},
		error: function (xhr, ajaxOptions, thrownError){
			alert("Load error: " + thrownError + "\n\nNotify your administrator that the following design will not load:\n" + design);
			return false;
		},
		complete: function(){
		} 
	});
}

$j(document).ready(function() {
	refresh_page();
});