import { LightningElement,track } from 'lwc';
import getObjectNames from '@salesforce/apex/CustomDataExport.getObjectNames';
import getFieldNames from '@salesforce/apex/CustomDataExport.getFieldNames';
import getData from '@salesforce/apex/CustomDataExport.getData';
import getCount from '@salesforce/apex/CustomDataExport.getCount';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CustomDataExport extends LightningElement {
    @track objectOptions = []; //stores the list of objects coming from Apex
    @track fieldOptions = []; //stores the list of fields coming from Apex
    @track fetchFlag = false; //decides when to show the data table initially data table is hidden
    @track columns = []; //stores the columns for the data table
    @track data = []; //stores data for data table 
    @track dataCopy = []; //store the copy of original data (when filter is applied)
    @track objectName = '';

    @track filterOptions = []; //stores the filter options for the data table

    @track operatorOptions = [
        {label: 'Starts with',value: 'Like%'},
        {label: 'Ends with',value: '%Like'},
        {label: 'Contains',value: '%Like%'},
        {label: 'First Letter Starts with',value: '_Like'}
    ];


    _selected = []; //shows only selected fields by the user while choosing fields

    selectedRows = []; //stores only selected rows by the user in the data table

    selectedOperator = '';
    selectedFilterOn = '';

    offsetCount = 0; //stores the offset count for the data table
    loadMoreStatus; //stores the status of loading (in data table)
    targetDataTable; //will hold the reference of targeted data table
    totalNumberOfRows; //it is the last limit of load more records in data table


    connectedCallback(){
        //get all the names of objects from Apex
        getObjectNames().then(response=>{
            //console.log(JSON.parse(response));
            this.objectOptions = JSON.parse(response);
        }).catch(error=>{
            console.log(error);
        });
    }

    handleObject(event){
        this.objectName = event.detail.value;
        console.log(this.objectName);

        //imperative call to get object fields list
        getFieldNames({objectName:this.objectName}).then(response=>{
            console.log(response);
            this.fieldOptions = JSON.parse(response);
        }).catch(error=>{
            console.log(error);
        });
    }

    handleFields(event){
        //console.log(event.detail.value);
        this._selected = event.detail.value;

        //clear the filter options
        this.filterOptions.splice(0,this.filterOptions.length);

        //creating filter options from the _selected options
        this._selected.forEach(item=>{
            const json = {
                label: item,
                value: item
            }
            this.filterOptions.push(json);
        });
    }

    fetchRecords(){
        
        //check for the fields selected or not
        if(this._selected.length != 0){
            //first fetch total number of records
            getCount({objectName: this.objectName,filterMap: {}}).then(response=>{
                this.totalNumberOfRows = response; //response will return total number of rows

                if(parseInt(this.totalNumberOfRows) > 0 && this.offsetCount <= parseInt(this.totalNumberOfRows)){
                    //store the selected values in the array
                    //let fields = [];
                    for(let i=0;i<this._selected.length;i++){
                        //create column for the data table
                        let json = {
                            label: this._selected[i],
                            fieldName: this._selected[i]
                        };
                        console.log('json = '+json);

                        this.loadMoreStatus = '';
                        this.columns.push(json);
                        //fields.push(this._selected[i]); //purpose: to send to the apex as list format
                    }
                    this.fetchFlag = true; //will make data table visible

                    if(this.targetDataTable && this.offsetCount > parseInt(this.totalNumberOfRows)){
                        this.targetDataTable.enableInfiniteLoading = false;
                        this.loadMoreStatus = 'No more data to load';
                        this.targetDataTable.isLoading = false;
                    } else{
                        //fetch data and load in the data table
                        getData({objectName:this.objectName,fields:this._selected ,filterMap:{}, offsetCount: this.offsetCount}).then(response=>{
                            console.log(JSON.parse(response));
                            response = JSON.parse(response);
                            this.data = [...this.data,...response];
                            this.dataCopy = [...this.data,...response];
                            if(this.targetDataTable) {
                                this.targetDataTable.isLoading = false; //hide the spinner icon
                            }
                        }).catch(error=>{
                            console.log(error);
                        });
                    }
                } else{
                const toast = new ShowToastEvent({
                    title: 'No Records found',
                    message: 'Select any/all fields to fetch data',
                    variant: 'Warning'
                });
                this.dispatchEvent(toast);
            } 
            }).catch(error=>{
                console.log(error);
            }); 
        }else{
            //show error
            const toast = new ShowToastEvent({
                title: 'No Fields Selected',
                message: 'Select any/all fields to fetch data',
                variant: 'Warning'
            });
            this.dispatchEvent(toast);
        }
    }

    exportData(){
        if(this.selectedRows.length > 0){
            console.log('export button clicked');
            //let doc = this.template.querySelector('[data-id=dataTable]').innerText;
            //console.log(doc.innerHTML);
            
            //apply styles
            
            // Prepare a html table
            let doc = '<table>';
            
            // Add all the Table Headers
            doc += '<tr>';
            this.columns.forEach(element => {            
                doc += '<th>'+ element.fieldName +'</th>'           
            });
            doc += '</tr>';
            
            // Add the data rows
            this.selectedRows.forEach(item1=>{
                doc += '<tr>';
                const map = new Map(Object.entries(item1));
                this.columns.forEach(item2=>{
                    doc += '<td>';
                    doc += map.get(item2.fieldName);
                    console.log('Item value = '+map.get(item2.fieldName));
                    doc += '</td>';
                });
                doc += '</tr>';
            });
            doc += '</table>';
            
            var element = 'data:application/vnd.ms-excel,' + encodeURIComponent(doc);
            let downloadElement = document.createElement('a');
            downloadElement.href = element;
            downloadElement.target = '_self';
            // use .csv as extension on below line if you want to export data as csv
            downloadElement.download = this.objectName+'.xls';
            document.body.appendChild(downloadElement);
            downloadElement.click();
        }else{
            const toast = new ShowToastEvent({
                title: 'No rows selected',
                message: 'Please select any/all rows to export data',
                variant: 'Warning'
            });
            this.dispatchEvent(toast);
        }
    }

    //handles data table row selection
    getSelectedItem(event){
        //first clear the list (so that we can check for no record selected)
        this.selectedRows.splice(0,this.selectedRows.length);

        event.detail.selectedRows.forEach(item=>{
            this.selectedRows.push(item);
        });
        console.log('Selected items:'+this.selectedRows);
    }

    /* Filter options */
    handleOperators(event){ 
        this.selectedOperator = event.detail.value;
    }

    handleFilters(event){
        this.selectedFilterOn = event.detail.value;
    }

    filterRecords(){
        if(this.selectedFilterOn != '' && this.selectedOperator != ''){
            //take out the expression
            let expression = this.template.querySelector('[data-id=exp]').value;

            //create filterMap
            const filterMap = {
                'fieldName': this.selectedFilterOn,
                'clause': this.selectedOperator,
                'expression': expression
            };
            console.log('ReRendering the data after filter');

            //call Apex to send query and filter the records, fetch data and load in the data table
            getData({objectName:this.objectName,fields:this._selected,filterMap:filterMap,offsetCount:0}).then(response=>{
                console.log(JSON.parse(response));
                this.data = JSON.parse(response);
            }).catch(error=>{
                console.log(error);
            });
        }
    }

    clearFilter(){
        console.log('Clear filter button called');
        if(this.dataCopy.length > 0){
            console.log('clear filter inside if');
            //it is only possible when the filter is applied to the fields
            this.data = this.dataCopy; //copy back the original data in the data
        }
    }

    handleLoadMore(event){
        event.preventDefault();

        //increase the offset count first
        this.offsetCount += 20;

        //display spinner to show the loading process
        event.target.isLoading = true;

        this.targetDataTable  = event.target; //stores the reference of target data table

        this.loadMoreStatus = 'Loading...';

        //agin call the fetchRecords function
        this.fetchRecords();
    }

}