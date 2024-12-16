/**
 * predtimechart: A JavaScript (ES6 ECMAScript) module for forecast visualization.
 */

import {closestYear} from "./utils.js";
import _validateOptions from './validation.js';


//
// helper functions
//

// `updateModelsList()` helper
function _selectModelDiv(model, modelColor, isEnabled, isChecked) {
    const checked = isChecked ? 'checked' : '';
    return `<div class="form-group form-check"
                 style="margin-bottom: 0${!isEnabled ? '; color: lightgrey' : ''}">
                <label>
                    <input type="checkbox" id="${model}" class="model-check" ${checked}>
                    &nbsp;${model}
                    &nbsp;<span class="forecastViz_dot" style="background-color: ${modelColor}; "></span>
                </label>
            </div>`;
}


// event handler helper
function _setSelectedTruths() {
    const isCurrTruthChecked = $("#forecastViz_Current_Truth").prop('checked');
    const isAsOfTruthChecked = $("#forecastViz_Truth_as_of").prop('checked');  // ""
    const selectedTruths = [];
    if (isCurrTruthChecked) {
        selectedTruths.push('Current Target');
    }
    if (isAsOfTruthChecked) {
        selectedTruths.push('Target as of');
    }
    this.state.selected_truth = selectedTruths;
    this.fetchDataUpdatePlot(false, false);
}


/**
 * `initialize()` helper that builds UI by adding DOM elements to $componentDiv. the UI is one row with two columns:
 * options on left and the plotly plot on the right
 *
 * @param $componentDiv - an empty Bootstrap 4 row (JQuery object)
 * @param taskIdsKeys - array of options.task_ids keys. used to create task rows - one per task ID
 * @param isDisclaimerPresent - true if we need to show a disclaimer from options
 * @private
 */
function _createUIElements($componentDiv, taskIdsKeys, isDisclaimerPresent) {
    //
    // helper functions for creating for rows
    //

    function titleCase(str) {  // per https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    }

    function _createFormRow(selectId, label) {
        return $(
            `<div class="form-row">\n` +
            `    <label for="${selectId}" class="col-sm-4 col-form-label">${label}:</label>\n` +
            `    <div class="col-sm-8">\n` +
            `        <select id="${selectId}" class="form-control"></select>\n` +
            `    </div>\n` +
            `</div>`)
    }


    //
    // make $optionsDiv (left column)
    //
    const $optionsDiv = $('<div class="col-md-3" id="forecastViz_options"></div>');

    // add Outcome, task ID, and Interval selects (form). NB: these are unfilled; their <OPTION>s are added by
    // initializeTargetVarsUI(), initializeTaskIDsUI(), and initializeIntervalsUI(), respectively
    const $optionsForm = $('<form></form>');
    $optionsForm.append(_createFormRow('target_variable', 'Outcome'));
    taskIdsKeys.forEach(taskIdKey => {
        $optionsForm.append(_createFormRow(taskIdKey, titleCase(taskIdKey.replace(/[_-]/g, ' '))));  // replace w/spaces
    });
    $optionsForm.append(_createFormRow('intervals', 'Interval'));
    $optionsDiv.append($optionsForm);

    // add truth checkboxes
    const $truthCheckboxesDiv = $(
        '<div class="form-group form-check forecastViz_select_data ">\n' +
        '    <input title="curr target" type="checkbox" id="forecastViz_Current_Truth" value="Current Target" checked>\n' +
        '      &nbsp;<span id="currentTruthDate">Current (current target date here)</span>\n' +
        '      &nbsp;<span class="forecastViz_dot" style="background-color: lightgrey; "></span>\n' +
        '    <br>\n' +
        '    <input title="target as of" type="checkbox" id="forecastViz_Truth_as_of" value="Target as of" checked>\n' +
        '      &nbsp;<span id="asOfTruthDate">(as of truth date here)</span>\n' +
        '      &nbsp;<span class="forecastViz_dot" style="background-color: black;"></span>\n' +
        '</div>');
    $optionsDiv.append('<div class="pt-md-3">Select Target Data:</div>');
    $optionsDiv.append($truthCheckboxesDiv);

    // add model list controls
    $optionsDiv.append($(
        '<button type="button" class="btn btn-sm rounded-pill" id="forecastViz_shuffle" style="float: right;">\n' +
        '    Shuffle Colours</button>\n' +
        '<label class="forecastViz_label" for="forecastViz_all">Select Models:</label>\n' +
        '<input type="checkbox" id="forecastViz_all">'));

    // add the model list itself
    $optionsDiv.append($('<div id="forecastViz_select_model"></div>'));


    //
    // make $vizDiv (right column)
    //
    const $vizDiv = $('<div class="col-md-9" id="forecastViz_viz"></div>');
    const $buttonsDiv = $(
        '<div class="container">\n' +
        '    <div class="col-md-12 text-center">\n' +
        '        <button type="button" class="btn btn-primary" id="decrement_as_of">&lt;</button>\n' +
        '        <button type="button" class="btn btn-primary" id="increment_as_of">&gt;</button>\n' +
        '    </div>\n' +
        '</div>'
    );
    if (isDisclaimerPresent) {
        $vizDiv.append($('<p class="forecastViz_disclaimer"><b><span id="disclaimer">(disclaimer here)</span></b></p>'));
    }
    $vizDiv.append($('<div id="ploty_div" style="width: 100%; height: 72vh; position: relative;"></div>'));
    $vizDiv.append($buttonsDiv);
    $vizDiv.append($('<p style="text-align:center"><small>Note: You can navigate to forecasts from previous weeks with the left and right arrow keys</small></p>'));


    //
    // finish
    //
    $componentDiv.empty().append($optionsDiv, $vizDiv);
}


//
// saveFile() helper for $("#downloadUserEnsemble").click()
// - per https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
//

function download(content, mimeType, filename) {
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
        const a = document.createElement('a')
        document.body.appendChild(a);
        const blob = new Blob([content], {type: mimeType}) // Create a blob (file-like object)
        const url = URL.createObjectURL(blob)
        a.setAttribute('href', url)
        a.setAttribute('download', filename)
        a.click()  // Start downloading
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 0)
    }
}


/**
 * Shows a modal dialog with a close button.
 *
 * @param {String} - title
 * @param {String} - message
 */
function showDialog(title, message) {
    console.log(`flashMessage(): ${message}`);
    const modal$ = $(`
        <div class="modal fade" id="showDialogModal" tabindex="-1" role="dialog" aria-labelledby="showDialogModalLabel" aria-hidden="true">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="showDialogModalLabel">${title}</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="modal-body">${message}</div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>`);
    modal$.modal('show');
}


//
// App
//

// this implements a straightforward SPA with state - based on https://dev.to/vijaypushkin/dead-simple-state-management-in-vanilla-javascript-24p0
const App = {

    //
    // non-options vars passed to `initialize()`
    //

    isIndicateRedraw: false,  // true if app should set plot opacity when loading data
    _fetchData: null,         // as documented in `initialize()`


    //
    // app state
    //

    state: {
        // Static data, fixed at time of creation:
        target_variables: [],
        task_ids: [],
        intervals: [],
        available_as_ofs: [],
        current_date: "",
        models: [],
        disclaimer: "",

        // Dynamic/updated data, used to track 2 categories:
        // 1/2 Tracks UI state:
        selected_target_var: '',
        selected_interval: '',
        selected_as_of_date: '',
        selected_truth: ['Current Target', 'Target as of'],
        selected_models: [],
        last_selected_models: [],  // last manually-selected models. used by "Select Models" checkbox
        colors: [],
        initial_xaxis_range: null,  // initialize() option
        initial_yaxis_range: null,  // ""

        // 2/2 Data used to create plots:
        current_truth: [],
        as_of_truth: [],
        forecasts: {},
    },


    //
    // initialization-related functions
    //

    /**
     * Initialize this app using the passed args. Note that we support specifying some aspects of UI selection state via
     * these URL parameters: `as_of`, `interval`, `target_var`, `model` (one or more), and task_ids (one or more). For
     * example, this URL specifies the first three along with two models and two task_ids:
     *   http://.../?as_of=2022-01-29&model=COVIDhub-baseline&model=COVIDhub-ensemble&interval=95%25&target_var=week_ahead_incident_deaths&scenario_id=1&location=48
     *
     * @param {String} componentDiv - id of a DOM node to populate. it must be an empty Bootstrap 4 row
     * @param {Function} _fetchData - function as documented in README.md .
     *   args: isForecast, targetKey, taskIDs, referenceDate
     * @param {Boolean} isIndicateRedraw - controls whether the plot area should be grayed out while waiting for data
     *   requests
     * @param {Object} options - visualization initialization options as documented at https://docs.zoltardata.com/visualizationoptionspage/
     * @returns {String} - error message String or null if no error
     */
    initialize(componentDiv, _fetchData, isIndicateRedraw, options) {
        this._fetchData = _fetchData;
        this.isIndicateRedraw = isIndicateRedraw;

        console.debug('initialize(): entered');

        // validate componentDiv
        const componentDivEle = document.getElementById(componentDiv);
        if (componentDivEle === null) {
            throw `componentDiv DOM node not found: '${componentDiv}'`;
        }

        // validate options object
        try {
            _validateOptions(options);
            console.debug('initialize(): passed options are valid');
        } catch (error) {
            console.error(`invalid option(s): ${error}`);
            showDialog('Init failed due to invalid option(s)', error);
            return error;  // leave display default/blank
        }

        // validate options object merged with URL params, if present
        let isShowOptionsInURL = false;
        const optionsFromURL = this.getOptionsFromURL(options['task_ids']);
        if (Object.keys(optionsFromURL).length !== 0) {
            const mergedOptions = {...options, ...optionsFromURL}  // NB: second overrides first
            try {
                _validateOptions(mergedOptions);
                console.debug('initialize(): merged options are valid');
                options = mergedOptions;
            } catch (error) {
                console.error(`invalid URL option(s): ${error}`);
                showDialog('Ignoring invalid URL parameter(s)', error);
                isShowOptionsInURL = true;
            }
        }

        // save static vars
        this.state.target_variables = options['target_variables'];
        this.state.task_ids = options['task_ids'];
        this.state.intervals = options['intervals'];
        this.state.available_as_ofs = options['available_as_ofs'];
        this.state.current_date = options['current_date'];
        this.state.models = options['models'];
        this.state.disclaimer = options['disclaimer'];  // undefined if not present
        this.state.colors = Array(parseInt(this.state.models.length / 10, 10) + 1).fill([
            '#0d0887',
            '#46039f',
            '#7201a8',
            '#9c179e',
            '#bd3786',
            '#d8576b',
            '#ed7953',
            '#fb9f3a',
            '#fdca26',
            '#f0f921'
        ]).flat()
        this.state.initial_xaxis_range = options.hasOwnProperty('initial_xaxis_range') ? options['initial_xaxis_range'] : null;
        this.state.initial_yaxis_range = options.hasOwnProperty('initial_yaxis_range') ? options['initial_yaxis_range'] : null;

        // save initial selected state
        this.state.selected_target_var = options['initial_target_var'];
        this.state.selected_interval = options['initial_interval'];
        this.state.selected_as_of_date = options['initial_as_of'];
        // this.state.selected_truth: synchronized via default <input ... checked> setting
        this.state.selected_models = options['initial_checked_models'];

        // populate UI elements, setting selection state to initial
        console.debug('initialize(): initializing UI');
        const $componentDiv = $(componentDivEle);
        const isDisclaimerPresent = options.hasOwnProperty('disclaimer');
        _createUIElements($componentDiv, Object.keys(this.state.task_ids), isDisclaimerPresent);
        this.initializeUI(options['initial_task_ids'], isDisclaimerPresent);

        // wire up UI controls (event handlers)
        this.addEventHandlers();

        // pull initial data (current truth, selected truth, and selected forecast) and update the plot
        console.debug('initialize(): fetching data and updating plot');
        this.fetchDataUpdatePlot(true, true);

        // show corrected url if params were invalid
        if (isShowOptionsInURL) {
            this.showOptionsInURL();
        }

        console.debug('initialize(): done');
        return null;  // no error
    },
    /**
     * initialize() helper that returns an object like that function's `options` object, but filled with values from the
     * current window location. Does not check for missing parameters.
     *
     * @param {Object} task_ids - as passed to initialize()'s options['task_ids']
     * @returns {Object}
     */
    getOptionsFromURL(task_ids) {
        const options = {};
        const searchParams = new URLSearchParams(window.location.search)
        if (searchParams.get('as_of')) {
            options['initial_as_of'] = searchParams.get('as_of');
        }
        if (searchParams.get('interval')) {
            options['initial_interval'] = searchParams.get('interval');
        }
        if (searchParams.get('target_var')) {
            options['initial_target_var'] = searchParams.get('target_var');
        }
        if (searchParams.get('model')) {  // at least one
            options['initial_checked_models'] = searchParams.getAll('model');
        }
        if (searchParams.get('xaxis_range')) {
            options['initial_xaxis_range'] = searchParams.getAll('xaxis_range');
        }
        if (searchParams.get('yaxis_range')) {
            options['initial_yaxis_range'] = searchParams.getAll('yaxis_range');
        }

        const initial_task_ids = {}; // NB: these are values, not text
        Object.keys(task_ids).forEach(function (taskIdKey) {
            if (searchParams.get(taskIdKey)) {
                initial_task_ids[taskIdKey] = searchParams.get(taskIdKey);
            }
        });
        if (Object.keys(initial_task_ids).length !== 0) {
            options['initial_task_ids'] = initial_task_ids;
        }

        return options;
    },
    showOptionsInURL() {
        const newUrl = new URL(window.location.origin + window.location.pathname);
        newUrl.searchParams.append("as_of", this.state.selected_as_of_date);
        newUrl.searchParams.append("interval", this.state.selected_interval);
        newUrl.searchParams.append("target_var", this.state.selected_target_var);

        const plotyDiv = document.getElementById('ploty_div');
        if (plotyDiv.data.length !== 0) {  // we have data to plot. o/w plotyDiv.layout.* is undefined
            const currXAxisRange = plotyDiv.layout.xaxis.range;
            const currYAxisRange = plotyDiv.layout.yaxis.range;
            const isXAxisRangeDefault = ((currXAxisRange.length === 2) && (currXAxisRange[0] === -1) && (currXAxisRange[1] === 6));
            const isYAxisRangeDefault = ((currYAxisRange.length === 2) && (currYAxisRange[0] === -1) && (currYAxisRange[1] === 4));
            if (!isXAxisRangeDefault) {
                plotyDiv.layout.xaxis.range.forEach(xRangeDateTimeStr => {  // ex: "2022-02-03 18:17:12.8268" or "2022-02-03"
                    const xRangeDate = xRangeDateTimeStr.slice(0, 10);
                    newUrl.searchParams.append("xaxis_range", xRangeDate);
                });
            }
            if (!isYAxisRangeDefault) {
                plotyDiv.layout.yaxis.range.forEach(yRangeValue => {
                    newUrl.searchParams.append("yaxis_range", yRangeValue);
                });
            }
        }

        this.state.selected_models.forEach(model => {
            newUrl.searchParams.append("model", model);
        });

        for (const [taskID, taskValue] of Object.entries(this.selectedTaskIDValues())) {
            newUrl.searchParams.append(taskID, taskValue);
        }

        // following is to prevent browser history errors resulting from calling `replaceState()` too many times, e.g.,
        // in Firefox: "Too many calls to Location or History APIs within a short timeframe."
        if ((window.history.state === null) || (newUrl.toString() !== window.history.state.toString())) {
            window.history.replaceState(newUrl.toString(), '', newUrl);
        }
    },
    initializeUI(initial_task_ids, isDisclaimerPresent) {
        // populate options and models list (left column)
        this.initializeTargetVarsUI();
        this.initializeTaskIDsUI(initial_task_ids);
        this.initializeIntervalsUI();
        this.updateModelsList();

        // initialize current and as_of truth checkboxes' text
        $("#currentTruthDate").text(`Current (${this.state.current_date})`);
        this.updateTruthAsOfCheckboxText();

        // initialize disclaimer
        if (isDisclaimerPresent) {
            $('#disclaimer').text(this.state.disclaimer);
        }

        // initialize plotly (right column)
        const plotyDiv = document.getElementById('ploty_div');
        const data = []  // data will be update by `updatePlot()`
        const layout = this.getPlotlyLayout();
        const calendarIcon = {  // https://fontawesome.com/icons/calendar-days?f=classic&s=solid
            'width': 448,
            'height': 512,
            'path': "M128 0c17.7 0 32 14.3 32 32V64H288V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H448V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192zm64 80v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm128 0v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H208c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H336zM64 400v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H208zm112 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H336c-8.8 0-16 7.2-16 16z"
        };
        Plotly.newPlot(plotyDiv, data, layout, {
            modeBarButtonsToRemove: ['lasso2d', 'autoScale2d'],
            modeBarButtonsToAdd: [{
                name: 'Jump to As_Of',
                icon: calendarIcon,
                click: () => null,  // click (required here) is handled by daterangepicker below
            }]
        });

        // add an event listener (must be defined after above `newPlot()` call) to handle plot changes by updating the
        // URL's two `initial_xaxis_range` and `initial_yaxis_range` params. NB: this event fires on every drag instead
        // of on, mouseups, causing a lot of activity: Range slider emits relayout evt on mousemove, should be only on
        // mouseup: https://github.com/plotly/plotly.js/issues/2216
        plotyDiv.on('plotly_relayout', function () {
            App.showOptionsInURL();
        });

        this.initializeDateRangePicker();  // b/c jquery binding is apparently lost with any Plotly.*() call
    },
    initializeDateRangePicker() {
        // initialize https://www.daterangepicker.com/ . regarding the jquery selector for the above icon, the svg is:
        // <a rel="tooltip" class="modebar-btn" data-title="Jump to As_Of" data-attr="my attr" data-val="my val" data-toggle="false" data-gravity="n">
        const $icon = $("[data-title='Jump to As_Of']");  // NB: couldn't get this to work: $(".modebar-btn [data-title='Jump to As_Of']");
        const available_as_ofs = App.state.available_as_ofs[App.state.selected_target_var];
        $icon.daterangepicker({  // we use below 'apply.daterangepicker' instead of a callback to get more control, esp. to receive "today" clicks
            singleDatePicker: true,
            showDropdowns: true,
            minYear: parseInt(available_as_ofs[0].slice(0, 4)),
            maxYear: parseInt(available_as_ofs.at(-1).slice(0, 4)),
        });
        $icon.on('apply.daterangepicker', function (ev, picker) {
            const pickedDate = picker.startDate.format('YYYY-MM-DD');
            const availableAsOfs = App.state.available_as_ofs[App.state.selected_target_var];
            const closestAsOf = closestYear(pickedDate, availableAsOfs);

            // reset picked date to today (o/w stays on picked date)
            picker.setStartDate(new Date());
            picker.setEndDate(new Date());

            // go to picked date if different from current
            if (closestAsOf !== App.state.selected_as_of_date) {
                App.state.selected_as_of_date = closestAsOf;
                App.fetchDataUpdatePlot(true, false);
                App.updateTruthAsOfCheckboxText();
            }
        });

    },
    initializeTargetVarsUI() {
        // populate the target variable <SELECT>
        const $targetVarsSelect = $("#target_variable");
        const thisState = this.state;
        // $targetVarsSelect.empty();
        this.state.target_variables.forEach(function (targetVar) {
            const selected = targetVar.value === thisState.selected_target_var ? 'selected' : '';
            const optionNode = `<option value="${targetVar.value}" ${selected} >${targetVar.text}</option>`;
            $targetVarsSelect.append(optionNode);
        });
    },
    initializeTaskIDsUI(initialTaskIds) {
        // populate task ID-related <SELECT>s
        const thisState = this.state;
        Object.keys(this.state.task_ids).forEach(function (taskIdKey) {
            const $taskIdSelect = $(`#${taskIdKey}`);  // created by _createUIElements()
            // $taskIdSelect.empty();
            const taskIdValueObjs = thisState.task_ids[taskIdKey];
            taskIdValueObjs.forEach(taskIdValueObj => {
                const selected = taskIdValueObj.value === initialTaskIds[taskIdKey] ? 'selected' : '';
                const optionNode = `<option value="${taskIdValueObj.value}" ${selected} >${taskIdValueObj.text}</option>`;
                $taskIdSelect.append(optionNode);
            });
        });
    },
    initializeIntervalsUI() {
        // populate the interval <SELECT>
        const $intervalsSelect = $("#intervals");
        const thisState = this.state;
        // $intervalsSelect.empty();
        this.state.intervals.forEach(function (interval) {
            const selected = interval === thisState.selected_interval ? 'selected' : '';
            const optionNode = `<option value="${interval}" ${selected} >${interval}</option>`;
            $intervalsSelect.append(optionNode);
        });
    },
    updateModelsList() {
        // populate the select model div
        const $selectModelDiv = $("#forecastViz_select_model");
        const thisState = this.state;
        $selectModelDiv.empty();

        // split models into two groups: those with forecasts (enabled, colored) and those without (disabled, gray)
        // 1. add models with forecasts
        this.state.models
            .filter(function (model) {
                return App.state.forecasts.hasOwnProperty(model);
            })
            .forEach(function (model) {
                const isChecked = (thisState.selected_models.indexOf(model) > -1);
                const modelIdx = thisState.models.indexOf(model);
                $selectModelDiv.append(_selectModelDiv(model, thisState.colors[modelIdx], true, isChecked));
            });

        // 2. add models without forecasts
        this.state.models
            .filter(function (model) {
                return !App.state.forecasts.hasOwnProperty(model);
            })
            .forEach(function (model) {
                const isChecked = (thisState.selected_models.indexOf(model) > -1);
                $selectModelDiv.append(_selectModelDiv(model, 'grey', false, isChecked));
            });

        // re-wire up model checkboxes
        this.addModelCheckEventHandler();
    },
    addEventHandlers() {
        // option, task ID, and interval selects
        $('#target_variable').on('change', function () {
            App.state.selected_target_var = this.value;
            App.fetchDataUpdatePlot(true, true);
            App.showOptionsInURL();
        });
        Object.keys(this.state.task_ids).forEach(function (taskIdKey) {
            const $taskIdSelect = $(`#${taskIdKey}`);  // created by _createUIElements()
            $taskIdSelect.on('change', function () {
                App.fetchDataUpdatePlot(true, true);
            });
        });
        $('#intervals').on('change', function () {
            App.state.selected_interval = this.value;
            App.fetchDataUpdatePlot(false, false);
            App.showOptionsInURL();
        });

        // truth checkboxes
        $("#forecastViz_Current_Truth").change(function () {
            _setSelectedTruths();
        });
        $("#forecastViz_Truth_as_of").change(function () {
            _setSelectedTruths();
        });

        // Shuffle Colours button
        $("#forecastViz_shuffle").click(function () {
            App.state.colors = App.state.colors.sort(() => 0.5 - Math.random())
            App.updateModelsList();
            App.updatePlot(true);
        });

        // "Select Models" checkbox
        $("#forecastViz_all").change(function () {
            const $this = $(this);
            const isChecked = $this.prop('checked');
            if (isChecked) {
                App.state.last_selected_models = App.state.selected_models;
                App.state.selected_models = App.selectableModels();
            } else {
                App.state.selected_models = App.state.last_selected_models;
            }
            App.checkModels(App.state.selected_models);
            App.updatePlot(true);
            App.showOptionsInURL();
        });

        // wire up model checkboxes
        this.addModelCheckEventHandler();

        // left and right buttons
        $("#decrement_as_of").click(function () {
            App.decrementAsOf();
        });
        $("#increment_as_of").click(function () {
            App.incrementAsOf();
        });

        // left and right keys
        window.addEventListener('keydown', function (event) {
            if (event.code === "ArrowLeft") {
                App.decrementAsOf();
            } else if (event.code === "ArrowRight") {
                App.incrementAsOf();
            }
        });
    },
    addModelCheckEventHandler() {
        $(".model-check").change(function () {
            const $this = $(this);
            const model = $this.prop('id');
            const isChecked = $this.prop('checked');
            const isInSelectedModels = (App.state.selected_models.indexOf(model) > -1);
            if (isChecked && !isInSelectedModels) {
                App.state.selected_models.push(model);
            } else if (!isChecked && isInSelectedModels) {
                App.state.selected_models = App.state.selected_models.filter(function (value) {
                    return value !== model;
                });  // App.state.selected_models.remove(model);
            }
            App.fetchDataUpdatePlot(false, false);
            App.showOptionsInURL();
        });
    },


    //
    // event handler functions
    //

    incrementAsOf() {
        const state = this.state;
        const as_of_index = state.available_as_ofs[state.selected_target_var].indexOf(state.selected_as_of_date);
        if (as_of_index < state.available_as_ofs[state.selected_target_var].length - 1) {
            state.selected_as_of_date = state.available_as_ofs[state.selected_target_var][as_of_index + 1];
            this.fetchDataUpdatePlot(true, false);
            this.updateTruthAsOfCheckboxText();
            this.showOptionsInURL();
        }
    },
    decrementAsOf() {
        const state = this.state;
        const as_of_index = state.available_as_ofs[state.selected_target_var].indexOf(state.selected_as_of_date);
        if (as_of_index > 0) {
            state.selected_as_of_date = state.available_as_ofs[state.selected_target_var][as_of_index - 1];
            this.fetchDataUpdatePlot(true, false);
            this.updateTruthAsOfCheckboxText();
            this.showOptionsInURL();
        }
    },
    updateTruthAsOfCheckboxText() {
        $("#asOfTruthDate").text(`As of ${this.state.selected_as_of_date}`);
    },

    // Returns an array of models that are not grayed out.
    selectableModels() {
        return this.state.models.filter(function (model) {
            return App.state.forecasts.hasOwnProperty(model);
        });
    },

    // Checks each item in #forecastViz_select_model that's in the passed list.
    checkModels(models) {
        this.state.models.forEach(function (model) {
            const isShouldCheck = (models.indexOf(model) > -1);
            const $modelCheckbox = $(`#${model}`);
            $modelCheckbox.prop('checked', isShouldCheck);
        });
    },

    // Returns information about the task ID <SELECT>(s) as an object similar to format of `task_ids` except that each
    // value is the selected object, rather than a list of all possible task IDs. Example return value:
    // { "scenario_id": {"value": "2", "text": "scenario 2"},  "location": {"value": "48", "text": "Texas"} }
    selectedTaskIDs() {
        const theSelectedTaskIDs = {};  // return value. filled next
        Object.keys(this.state.task_ids).forEach(taskIdKey => {
            const $taskIdSelect = $(`#${taskIdKey}`);  // created by _createUIElements()
            const selectedTaskIdValue = $taskIdSelect.val();
            const taskIdObj = App.state.task_ids[taskIdKey].find(taskID => taskID['value'] === selectedTaskIdValue);
            theSelectedTaskIDs[taskIdKey] = taskIdObj;
        });
        return theSelectedTaskIDs;
    },
    /**
     * A fetch*() helper that returns a processed version of selectedTaskIDs() in the format of `initial_task_ids`. for
     * example, if selectedTaskIDs() = {"scenario_id": {"value": "1", "text": "scenario 1"}, "location": {"value": "48", "text": "Texas"}},
     * then this function returns {"scenario_id": "1", "location": "48"} .
     */
    selectedTaskIDValues() {
        const taskIdVals = {};
        for (const [taskID, taskIDObj] of Object.entries(this.selectedTaskIDs())) {
            taskIdVals[taskID] = taskIDObj['value'];
        }
        return taskIdVals;
    },

    //
    // date fetch-related functions
    //

    /**
     * Updates the plot, optionally first fetching data.
     *
     * @param isFetchFirst true if should fetch before plotting. false if no fetch
     * @param isFetchCurrentTruth applies if isFetchFirst: controls whether current truth is fetched in addition to
     *   as_of truth and forecasts. ignored if not isFetchFirst
     */
    fetchDataUpdatePlot(isFetchFirst, isFetchCurrentTruth) {
        const isResetYLimit = isFetchCurrentTruth;  // passed to updatePlot(). fetching truth means we need to recalculate y limits
        if (isFetchFirst) {
            const promises = [this.fetchAsOfTruth(), this.fetchForecasts()];
            if (isFetchCurrentTruth) {
                promises.push(this.fetchCurrentTruth());
            }
            console.debug(`fetchDataUpdatePlot(${isFetchFirst}, ${isFetchCurrentTruth}): waiting on promises`);
            const $plotyDiv = $('#ploty_div');
            if (this.isIndicateRedraw) {
                $plotyDiv.fadeTo(0, 0.25);
            }
            Promise.all(promises).then((values) => {
                console.debug(`fetchDataUpdatePlot(${isFetchFirst}, ${isFetchCurrentTruth}): Promise.all() done. updating plot`, values);
                this.updateModelsList();
                this.updatePlot(isResetYLimit);
                if (this.isIndicateRedraw) {
                    $plotyDiv.fadeTo(0, 1.0);
                }
            });
        } else {
            console.debug(`fetchDataUpdatePlot(${isFetchFirst}, ${isFetchCurrentTruth}): updating plot`);
            this.updatePlot(isResetYLimit);
        }
    },
    fetchCurrentTruth() {
        this.state.current_truth = [];  // clear in case of error
        return this._fetchData(false,  // Promise
            this.state.selected_target_var, this.selectedTaskIDValues(), this.state.current_date)
            .then(response => response.json())
            .then((data) => {
                this.state.current_truth = data;
            })
            .catch(error => console.error(`fetchCurrentTruth(): error: ${error.message}`));
    },
    fetchAsOfTruth() {
        this.state.as_of_truth = [];  // clear in case of error
        return this._fetchData(false,  // Promise
            this.state.selected_target_var, this.selectedTaskIDValues(), this.state.selected_as_of_date)
            .then(response => response.json())
            .then((data) => {
                this.state.as_of_truth = data;
            })
            .catch(error => console.error(`fetchAsOfTruth(): error: ${error.message}`));
    },
    fetchForecasts() {
        this.state.forecasts = {};  // clear in case of error
        return this._fetchData(true,  // Promise
            this.state.selected_target_var, this.selectedTaskIDValues(), this.state.selected_as_of_date)
            .then(response => response.json())  // Promise
            .then((data) => {
                this.state.forecasts = data;
            })
            .catch(error => console.error(`fetchForecasts(): error: ${error.message}`));
    },

    //
    // plot-related functions
    //

    /**
     * Updates the plot, preserving any current xaxis range limit, and optionally any current yaxis range limit
     *
     * @param isResetYLimit true if should reset any yaxis range limit currently set
     */
    updatePlot(isResetYLimit) {
        const plotyDiv = document.getElementById('ploty_div');
        const data = this.getPlotlyData();
        let layout = this.getPlotlyLayout();
        if (data.length === 0) {
            layout = {title: {text: `No Visualization Data Found for ${this.state.selected_as_of_date}`}};
        }

        // before updating the plot we store the xaxis and yaxis ranges so that we can relayout using them if need be.
        // NB: the default xaxis.range seems to be [-1, 6] when updating for the first time (yaxis.range = [-1, 4]).
        // there might be a better way to determine this.
        let currXAxisRange;
        let currYAxisRange;
        let isXAxisRangeDefault;
        let isYAxisRangeDefault;
        if (plotyDiv.data.length !== 0) {  // we have data to plot. o/w plotyDiv.layout.* is undefined
            currXAxisRange = plotyDiv.layout.xaxis.range;
            currYAxisRange = plotyDiv.layout.yaxis.range;
            isXAxisRangeDefault = ((currXAxisRange.length === 2) && (currXAxisRange[0] === -1) && (currXAxisRange[1] === 6));
            isYAxisRangeDefault = ((currYAxisRange.length === 2) && (currYAxisRange[0] === -1) && (currYAxisRange[1] === 4));
        }
        Plotly.react(plotyDiv, data, layout);
        if (plotyDiv.data.length !== 0) {  // we have data to plot. o/w plotyDiv.layout.* is undefined
            if (!isXAxisRangeDefault) {
                Plotly.relayout(plotyDiv, 'xaxis.range', currXAxisRange);
            } else if (this.state.initial_xaxis_range != null) {
                Plotly.relayout(plotyDiv, 'xaxis.range', this.state.initial_xaxis_range);
            }

            if (!isResetYLimit) {
                if (!isYAxisRangeDefault) {
                    Plotly.relayout(plotyDiv, 'yaxis.range', currYAxisRange);
                } else if (this.state.initial_yaxis_range != null) {
                    Plotly.relayout(plotyDiv, 'yaxis.range', this.state.initial_yaxis_range);
                }
            }
        }
        this.initializeDateRangePicker();  // b/c jquery binding is apparently lost with any Plotly.*() call
    },
    getPlotlyLayout() {
        if (this.state.target_variables.length === 0) {
            return {};
        }

        const variable = this.state.target_variables.filter((obj) => obj.value === this.state.selected_target_var)[0].plot_text;
        const taskIdTexts = Object.values(this.selectedTaskIDs()).map(taskID => taskID['text']);
        return {
            autosize: true,
            showlegend: false,
            title: {
                text: `Forecasts of ${variable} <br> in ${taskIdTexts.join(', ')} as of ${this.state.selected_as_of_date}`,
                x: 0.5,
                y: 0.90,
                xanchor: 'center',
                yanchor: 'top',
            },
            xaxis: {
                title: {text: 'Date'},
                rangeslider: {},
            },
            yaxis: {
                title: {text: variable, hoverformat: '.2f'},
                fixedrange: false
            }
        }
    },
    getPlotlyData() {
        const state = this.state;
        let pd = [];
        if (state.selected_truth.includes('Current Target') && Object.keys(state.current_truth).length !== 0) {
            pd.push({
                x: state.current_truth.date,
                y: state.current_truth.y,
                type: 'scatter',
                mode: 'lines',
                name: 'Current Target',
                marker: {color: 'darkgray'}
            })
        }
        if (state.selected_truth.includes('Target as of') && Object.keys(state.as_of_truth).length !== 0) {
            pd.push({
                x: state.as_of_truth.date,
                y: state.as_of_truth.y,
                type: 'scatter',
                mode: 'lines',
                opacity: 0.5,
                name: `Target as of ${state.selected_as_of_date}`,
                marker: {color: 'black'}
            })
        }

        let pd0 = []
        if (state.forecasts.length !== 0) {
            // add the line for predictive medians
            pd0 = Object.keys(state.forecasts).map((model) => {
                if (state.selected_models.includes(model)) {
                    const index = state.models.indexOf(model)
                    const model_forecasts = state.forecasts[model]
                    const date = model_forecasts.target_end_date
                    const lq1 = model_forecasts['q0.025']
                    const lq2 = model_forecasts['q0.25']
                    const mid = model_forecasts['q0.5']
                    const uq1 = model_forecasts['q0.75']
                    const uq2 = model_forecasts['q0.975']

                    // 1-3: sort model forecasts in order of target end date
                    // 1) combine the arrays:
                    const list = []
                    for (let j = 0; j < date.length; j++) {
                        list.push({
                            date: date[j],
                            lq1: lq1[j],
                            lq2: lq2[j],
                            uq1: uq1[j],
                            uq2: uq2[j],
                            mid: mid[j]
                        })
                    }

                    // 2) sort:
                    list.sort((a, b) => (moment(a.date).isBefore(b.date) ? -1 : 1))

                    // 3) separate them back out:
                    for (let k = 0; k < list.length; k++) {
                        model_forecasts.target_end_date[k] = list[k].date
                        model_forecasts['q0.025'][k] = list[k].lq1
                        model_forecasts['q0.25'][k] = list[k].lq2
                        model_forecasts['q0.5'][k] = list[k].mid
                        model_forecasts['q0.75'][k] = list[k].uq1
                        model_forecasts['q0.975'][k] = list[k].uq2
                    }

                    const x = [];
                    x.push(model_forecasts.target_end_date.slice(0)[0]);

                    const y = [];
                    y.push(model_forecasts['q0.5'].slice(0)[0]);

                    return {
                        x: x,
                        y: y,
                        mode: 'lines',
                        type: 'scatter',
                        name: model,
                        hovermode: false,
                        opacity: 0.7,
                        line: {color: state.colors[index]},
                        hoverinfo: 'none'
                    };
                }
                return []
            })
        }
        pd = pd0.concat(...pd)

        // add interval polygons
        let pd1 = []
        if (state.forecasts.length !== 0) {
            pd1 = Object.keys(state.forecasts).map((model) => {  // notes that state.forecasts are still sorted
                if (state.selected_models.includes(model)) {
                    const index = state.models.indexOf(model)
                    const is_hosp = state.selected_target_var === 'hosp'
                    const mode = is_hosp ? 'lines' : 'lines+markers'
                    const model_forecasts = state.forecasts[model]
                    let upper_quantile
                    let lower_quantile
                    const plot_line = {
                        // point forecast
                        x: model_forecasts.target_end_date,
                        y: model_forecasts['q0.5'],
                        type: 'scatter',
                        name: model,
                        opacity: 0.7,
                        mode,
                        line: {color: state.colors[index]}
                    }

                    if (state.selected_interval === '50%') {
                        lower_quantile = 'q0.25'
                        upper_quantile = 'q0.75'
                    } else if (state.selected_interval === '95%') {
                        lower_quantile = 'q0.025'
                        upper_quantile = 'q0.975'
                    } else {
                        return [plot_line]
                    }

                    const x = Object.keys(state.as_of_truth).length !== 0 ?
                        model_forecasts.target_end_date :
                        model_forecasts.target_end_date;
                    const y1 = Object.keys(state.as_of_truth).length !== 0 ?
                        model_forecasts[lower_quantile] :  // lower edge
                        model_forecasts[lower_quantile];
                    const y2 = Object.keys(state.as_of_truth).length !== 0 ?
                        model_forecasts[upper_quantile] :
                        model_forecasts[upper_quantile];  // upper edge
                    return [
                        plot_line,
                        {
                            // interval forecast -- currently fixed at 50%
                            x: [].concat(x, x.slice().reverse()),
                            y: [].concat(y1, y2.slice().reverse()),
                            fill: 'toself',
                            fillcolor: state.colors[index],
                            opacity: 0.3,
                            line: {color: 'transparent'},
                            type: 'scatter',
                            name: model,
                            showlegend: false,
                            hoverinfo: 'skip'
                        }
                    ]
                }
                return []
            })
        }
        pd = pd.concat(...pd1)

        // done!
        return pd
    },
};


export default App;  // export the module's main entry point
