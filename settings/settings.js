var page = browser.extension.getBackgroundPage();

//Show an alert and then fade out
function toggleAlert(alert) {
    alert.style.display = "block";
    setTimeout(function() { 
        alert.classList.add("fadeOut");
    }, 800);    
    setTimeout(function() { 
        alert.style.display = "none";
        alert.classList.remove("fadeOut"); 
    }, 1700);


}


/*
    Sidebar Logic
*/
//Switchs the sidebar
function sideBarSwitch(event) {
    var element = event.target;
    if(element.tagName == "SPAN") {
        element = element.parentElement;
    }
    //console.log(element);
    if(sideBarTabToContentMap.has(element)) {
        sideBarTabToContentMap.forEach(function(value, key, map) {         
            if(element == key) {
                key.classList.add("pure-menu-selected");
                value.style.display = 'block';
            } else {
                key.classList.remove("pure-menu-selected"); 
                value.style.display = 'none';
            }
        }); 
    }
}

//Map that stores the tab to the corresponding content
var sideBarTabToContentMap = new Map();
sideBarTabToContentMap.set(document.getElementById("tabWelcome"), document.getElementById("welcomeContent"));
sideBarTabToContentMap.set(document.getElementById("tabSettings"), document.getElementById("historySettingsContent"));
sideBarTabToContentMap.set(document.getElementById("tabURLList"), document.getElementById("listOfURLSContent"));
sideBarTabToContentMap.set(document.getElementById("tabAbout"), document.getElementById("aboutContent"));

//Set a click event for each tab in the Map
sideBarTabToContentMap.forEach(function(value, key, map) {
    key.addEventListener("click", sideBarSwitch);
});
document.getElementById("tabWelcome").click();

/*
    Welcome Logic
*/

page.storeCounterToLocal();
document.getElementById("sessionDeleted").textContent = page.historyDeletedCounter;
document.getElementById("totalDeleted").textContent = page.historyDeletedCounterTotal;

/*
    History Settings Logic
*/
//Setting the values from local storage
function restoreSettingValues() {
    browser.storage.local.get()
    .then(function(items) {
        document.getElementById("dayInput").value = items.daysToKeep;
        document.getElementById("keepHistorySwitch").checked = items.keepHistorySetting;
		document.getElementById("statLoggingSwitch").checked = items.statLoggingSetting;
    });
}
//Saving the values to local storage
function saveSettingsValues() {
    browser.storage.local.set({daysToKeep: document.getElementById("dayInput").value});

    if(document.getElementById("keepHistorySwitch").checked) {
        browser.storage.local.set({keepHistorySetting: true});
        page.createOldHistoryAlarm();
    } else {
        browser.storage.local.set({keepHistorySetting: false});
        page.deleteOldHistoryAlarm();
    }

    browser.storage.local.set({statLoggingSetting: document.getElementById("statLoggingSwitch").checked});

}

restoreSettingValues();

//Event handlers for the buttons
document.getElementById("saveSettings").addEventListener("click", function() {
    saveSettingsValues();
    toggleAlert(document.getElementById("saveConfirm"));
});

document.getElementById("cancelSettings").addEventListener("click", function() {
    restoreSettingValues();
    toggleAlert(document.getElementById("cancelConfirm"));
});

document.getElementById("manualCleanup").addEventListener("click", function() {
    page.deleteOldHistory();
    toggleAlert(document.getElementById("cleanupConfirm"));
});

document.getElementById("resetCounter").addEventListener("click", function() {
    page.resetCounter();
    toggleAlert(document.getElementById("resetCounterConfirm"));
});


/*
    List of URLS Logic
*/
//Remove the url where the user clicked
function clickRemoved(event) {
    if(event.target.classList.contains("removeButton")) {
        var URL = event.target.parentElement.textContent;
        //Slice the unicode times from the URL
        URL = URL.slice(1);
        URL = URL.trim();
        //console.log(URL);
        page.removeURL(URL);
		generateTableOfURLS();
    }
}

//Add URL by keyboard input
function addURLFromInput() {
    var input = document.getElementById("URLForm").value;
    if(input) {
        var URL = "http://www." + input;
        page.addURL(page.getHostname(URL));
        document.getElementById("URLForm").value = "";
        document.getElementById("URLForm").focus();  
        generateTableOfURLS();   
    }   
}

//Export the list of URLS as a text file
function downloadTextFile(arr) {
    var txt = "";
    arr.forEach(function(row) {
        txt += row;
        txt += "\n";
    });
 
    //console.log(csv);
    var hiddenElement = document.createElement('a');
    hiddenElement.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
    hiddenElement.target = '_blank';
    hiddenElement.download = 'urls.txt';
    document.body.appendChild(hiddenElement);
    hiddenElement.click();
    document.body.removeChild(hiddenElement);
}  


//Generate the url table
function generateTableOfURLS() {
    var tableContainerNode = document.getElementById('tableContainer');
	/*
    while (tableContainerNode.firstChild) {
        tableContainerNode.removeChild(tableContainerNode.firstChild);
    }
	*/
    browser.storage.local.get("URLS")
	.then(function (result) {
        var array = result.URLS;
        var arrayLength = array.length;
        var theTable = document.createElement('table');

        for (var i = 0, tr, td; i < arrayLength; i++) {
            tr = document.createElement('tr');
            td = document.createElement('td');
            var removeButton = document.createElement("span");
            removeButton.classList.add("removeButton");
            removeButton.addEventListener("click", clickRemoved);
            removeButton.innerHTML = "&times";
            td.appendChild(removeButton);
            td.appendChild(document.createTextNode(array[i]));
            tr.appendChild(td);
            theTable.appendChild(tr);
        }
		if(document.getElementById('tableContainer').hasChildNodes()) {
			document.getElementById('tableContainer').firstChild.replaceWith(theTable);
		} else {
			document.getElementById('tableContainer').appendChild(theTable);			
		}

    });
}

generateTableOfURLS();

//Event handler for the Remove All button
document.getElementById("clear").addEventListener("click", function() {
    page.clearURL();
    generateTableOfURLS();
});

//Event handler for the user entering a URL through a form
document.getElementById("add").addEventListener("click", addURLFromInput);

//Event handler when the user press "Enter" on a keyboard on the URL Form
document.getElementById("URLForm").addEventListener("keypress", function (e) {
    var key = e.which || e.keyCode;
    if (key === 13) {
      addURLFromInput();
    }
});

//Exports urls to a text file
document.getElementById("exportURLS").addEventListener("click", function() {
    browser.storage.local.get("URLS")
	.then(function(items) {
        downloadTextFile(items.URLS);
    });
});

//Import URLS by text
document.getElementById("importURLS").addEventListener("change", function() {
	var file = this.files[0];

	var reader = new FileReader();
	reader.onload = function(progressEvent){
	// Entire file
	//console.log(this.result);

	// By lines
	var lines = this.result.split('\n');
	for(var line = 0; line < lines.length; line++){
	  //console.log(lines[line]);
	  if(lines[line] != "") {
	  	page.addURL(lines[line]);
	  }
	}
	generateTableOfURLS();
	};
	reader.readAsText(file);
    //Reset the file uploaded
    document.getElementById("importURLS").type = "";
    document.getElementById("importURLS").type = "file";
});

