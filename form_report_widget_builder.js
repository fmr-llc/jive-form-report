/*
Jive - Form Report Widget

Copyright (c) 2015 Fidelity Investments
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

FILE DESCRIPTION
This is the Javascript library that drives the Form Report Builder app.

WIDGET DESCRIPTION
This Jive HTML widget allows the user to set up an analysis report by specifying a saved 
Form design (using the Form Widget Builder).
*/
var fidosreg_id = 'b764a0a9536448345dc227af95e192521d337b5e4c3560c859b89ecd0407004a';
var designIndex = 0;
var designCount = 0;
var designMax = 10;

/*
 * Jive AJAX JSON return packets will all have a first line that makes it an invalid.  This must be stripped off.
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
 * Large forms can cause the screen to return to the top of the screen on a resize.  This causes a lot of confusion.
 * This function controls the resize and returns the screen position to where it was.
 */
function resizeForm() {
	resizeMe();
}

/*
 * Validate that the selected design can be used for a form report.  The design must have a tag and at least one reporting field...
 */
function validate_design(design) {
	// Make sure at least one tag is specified in the design.
	if ( design.tags == "" ) {
		alert("Design error: \nThis design does not have at least one tag specified.  It cannot be used for a form report.");
		return false;
	}
	
	// Make sure at least one reporting field is in the design.
	var tally_elems = 0;
	for (ndx = 0; ndx < design.form_elements.length; ndx++ ) {
		if (design.form_elements[ndx].type == "radio"
			|| design.form_elements[ndx].type == "checkbox"
			|| design.form_elements[ndx].type == "singleselect"
			|| design.form_elements[ndx].type == "multiselect") {
			tally_elems += 1;
		}
	}
	if ( tally_elems == 0 ) {
		alert("Design error: \nThis design does not have at least one reporting field.  It needs at least one Radio button group, Checkbox, Single-Select, or Multi-Select field.  It cannot be used for a form report until one of these is included.");
		return false;
	}
	return true;
}

/*
 * Load the form design.
 */
function _formreport_load_design() {
	var design = $j('#_formreport_load #_formreport_load_designs .list-group-item.active');
	var designID = design[0].id;
	$j.ajax({ 
		type: 'GET', 
		url: '/api/core/v3/contents/' + designID, 
		dataType: 'json', 
		success: function (loaded_doc) {
			// The design is inside a span tag in the document content text field.  We have to parse it out...
			var design = $j('*:not(:has("*"))', loaded_doc.content.text).text().trim();
			try {
				json = $j.parseJSON(design);
			}
			catch (e) {
				alert("Parse error: "+e + "\n\nNotify your administrator that the following design is invalid:\n" + design);
				return false;
			};

			if ( ! validate_design(json)) {
				return false;
			}
			_formreport_showCode(designID);
		}, 
		error: function (xhr, ajaxOptions, thrownError){ 
			alert('ERROR: ' + thrownError + '\ndata:\n' + data + '\n\nYou will need to talk to the administrator of this form about this.  Look in the People tab for the owners.'); 
		}
	});
}

/*
 * User clicked a design.  We need to remove the active class from all designs, and add it to the clicked design.
 */
function _formreport_loadDesigns_activate(design) {
	if ( $j(design).hasClass('design-deleted') || $j(design).attr('id') == undefined ){
		return false;
	}
	$j('#_formreport_load #_formreport_load_designs .list-group-item.active').removeClass('active');
	$j(design).addClass('active');
	$j('#_formreport_load_load').attr('disabled', false);
}

/*
 * User clicked Load Form.  Search for this user's form designs and present a list.
 */
function _formreport_load_designs() {
	$j('#_formreport_load_prev').attr('disabled', true);
	$j('#_formreport_load_next').attr('disabled', true);
	$j('#_formreport_load_load').attr('disabled', true);
	$j('#_formreport_load #_formreport_load_designs').html( '<p style="text-align: center;"><img alt="" src="/images/jive-image-loading.gif"> Loading...</p>' );
	$j('#_formreport_code').hide();
	$j('#_formreport_load').show();
	// Search for all the __formreport_design forms this user has access to...
	$j.ajax({ 
		type: 'GET',
		url: '/api/core/v3/search/contents?filter=type(document)&filter=search(formWidgetBuilderDesign)&sort=updatedDesc&count=' + designMax + '&startIndex=' + designIndex, 
		dataType: 'json',
		success: function (forms) {
			designCount = forms.list.length;
			if (designCount || designIndex > 0) {
				var form_list = "";
				// Search through the list of results and make sure an exact match of the form name is in the list.
				$j(forms.list).each(function(index, form){ 
					// Returned documents with no contentID are deleted, so ignore them...
					if ( form.contentID != "null" ) {
						form_list += '<a class="list-group-item" id="' + form.contentID + '">' + form.subject + "</a>";
					} else {
						form_list += '<a class="list-group-item design-deleted" id="' + form.contentID + '">[DELETED] ' + form.subject + "</a>";
					}
				});
				if (designCount < designMax) {
					form_list += '<a class="list-group-item">End of list</a>';
					for (ndx = designCount + 1; ndx < designMax; ndx++) {
						form_list += '<a  class="list-group-item"> </a>';
					}
				}
				$j('#_formreport_load #_formreport_load_designs').html( form_list );
				$j('#_formreport_load #_formreport_load_designs a').click(function(e){
					_formreport_loadDesigns_activate( $j(this) );
					return false;
				});
				if (designIndex > 0) {
					$j('#_formreport_load_prev').attr('disabled', false);
				} else {
					$j('#_formreport_load_prev').attr('disabled', true);
				}
				if (designCount < designMax) {
					$j('#_formreport_load_next').attr('disabled', true);
				} else {
					$j('#_formreport_load_next').attr('disabled', false);
				}
			} else {
				alert('No form designs are available.  Only form designs you have access to are available for you to load.'); 
			}
		}, 
		error: function (xhr, ajaxOptions, thrownError){ 
			alert('ERROR: ' + thrownError + '\n\nCould not retrieve the list of form designs.  You will need to talk to the administrator about this.'); 
		},
		complete: function(){
			resizeMe();
		}
	}); 
}

function _formreport_prev_designs() {
	if (designIndex > designMax)
		designIndex -= designMax;
	else
		designIndex = 0;
	_formreport_load_designs();
}

function _formreport_next_designs() {
	designIndex += designMax;
	_formreport_load_designs();
}

/*
 * User clicked Show Code.  Validate form and format the output form.
 */
function _formreport_showCode(designID) {
	var code= "<scr"+"ipt src='/api/core/v3/attachments/file/" + jquery_content_id + "/data'></scr"+"ipt>\n"
			+ "<scr"+"ipt src='/api/core/v3/attachments/file/" + library_loader_content_id + "/data'></scr"+"ipt>\n"
			+ '<scr'+'ipt>\n'
			+ '$j.load_library("bootstrap.css");\n'
			+ '$j.load_library("bootstrap-theme.css");\n'
			+ '$j.load_library("form_report_widget.css");\n'
			+ '$j.load_library("bootstrap.js");\n'
			+ '$j.load_library("form_report_widget.js");\n'
			+ 'var designID="' + designID + '";\n'
			+ '<\/scr'+'ipt>\n'
			+ '<div id="report">\n'
			+ '	<div><h1 id="report_title"><\/h1><\/div>\n'
			+ '	<div><h3 style="float: left;" id="report_date"><\/h3><h3 style="float: right;" id="report_owner"><\/h3><br\/><br\/><br\/><\/div>\n'
			+ '	<div id="report_elements"><\/div>\n'
			+ '	<div><h3>Forms: <span id="report_form_count">0<\/span><\/h3><\/div>\n'
			+ '	<div>\n'
			+ '		<button id="button_refresh" name="button_refresh" class="btn btn-default" onclick="refresh_page()">Refresh<\/button>\n'
			+ '		<button id="button_gridlines" name="button_gridlines" class="btn btn-default _formreport_button" onclick="toggle_gridlines()">Grid On<\/button>\n'
			+ '		<button id="export_results" name="export_results" class="btn btn-default _formreport_button" onclick="export_results()">Export Results<\/button>\n'
			+ '		<button id="hide_export" name="hide_export" class="btn btn-default _formreport_button" style="display: none;" onclick="hide_export()">Hide Export<\/button>\n'
			+ '	<\/div>\n'
			+ '<\/div>\n'
			+ '<div id="report_export"><\/div>\n'
			+ '<div id="report_row" class="_form_report_processing"><\/div>\n'
			+ '<div id="report_total1" class="_form_report_processing"><\/div>\n'
			+ '<div id="report_total2" class="_form_report_processing"><\/div>\n'
			+ '<div><p><h3 style="color:#ffffff;">.<\/h3><\/p><\/div>';
	$j('#_formreport_code #code').text( code );
	$j('#_formreport_load').hide();
	$j('#_formreport_code').show();
	$j('#_formreport_code #code').select();
	resizeForm();
}

/*
 * Hide the code frame and display the main form frame and toolbox.
 */
function _formreport_hideCode() {
	_formreport_load_designs();
}

/*
 * When the widget is ready we need to set up event handlers for the fields that do not change in the DOM.
 */
$j(document).ready(function() {
	designIndex = 0;
	_formreport_load_designs();
});