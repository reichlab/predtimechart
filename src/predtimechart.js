/**
 * predtimechart: A JavaScript (ES6 ECMAScript) module for forecast visualization.
 */

import {
    closestYear,
    DEFAULT_SEASON_START_MONTH,
    filterTruthToSeason,
    getOptionsFromURL,
    seasonDateRange,
    seasonName,
    seasonStartYear,
    seasonsInDates,
    shiftDateStrByYears,
    splitTruthBySeason
} from "./utils.js";
import _validateOptions from './validation.js';


//
// helper functions
//

// `updateModelsList()` helper
function _selectModelDiv(model, modelUrl, modelColor, isEnabled, isChecked) {
    const iconLink = (isEnabled && modelUrl) ?
        `<a href="${modelUrl}" target="_blank" title="Click to open metadata for ${model} (new window)" class="ms-1"><i class="bi bi-box-arrow-up-right"></i></a>` : '';
    return `<div class="form-group form-check" style="margin-bottom: 0${!isEnabled ? '; color: lightgrey' : ''}">
                <input type="checkbox" id="${model}" class="model-check" ${isChecked ? 'checked' : ''} ${isEnabled ? '' : 'disabled'}>
                <label for="${model}" class="form-check-label">${model}</label>
                <span class="forecastViz_dot" style="background-color: ${modelColor};"></span>
                ${iconLink}
            </div>`;
}


// event handler helper. NB: 'Other Seasons' only applies in season mode, but we track its checkbox regardless so that
// the choice is remembered across season mode toggles
function _setSelectedTruths() {
    const isCurrTruthChecked = $("#forecastViz_Current_Truth").prop('checked');
    const isAsOfTruthChecked = $("#forecastViz_Truth_as_of").prop('checked');  // ""
    const isOtherSeasonsChecked = $("#forecastViz_Other_Seasons").prop('checked');  // ""
    const selectedTruths = [];
    if (isCurrTruthChecked) {
        selectedTruths.push('Current Target');
    }
    if (isAsOfTruthChecked) {
        selectedTruths.push('Target as of');
    }
    if (isOtherSeasonsChecked) {
        selectedTruths.push('Other Seasons');
    }
    App.state.selected_truth = selectedTruths;
    App.fetchDataUpdatePlot(false, false);
}


/**
 * getPlotlyData() helper.
 *
 * @param truthData {Object} truth data ala _fetchData()'s truth format: {date: [...], y: [...]}. NB: this is `[]`
 *   rather than an object before any data has been fetched, or after a fetch error
 * @returns {Boolean} true if `truthData` has at least one point to plot
 * @private
 */
function _hasTruthPoints(truthData) {
    return (truthData != null) && Array.isArray(truthData.date) && (truthData.date.length !== 0);
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
    // helper functions for creating rows
    //

    function titleCase(str) {  // per https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    }

    // NB: the label/select layout is ours (predtimechart.css), not Bootstrap's grid. consumers embed us in pages
    // whose Bootstrap build doesn't necessarily ship the grid - a Quarto site, say - and a `row`/`col-sm-*` that
    // silently does nothing puts the label back above its select, which is what this row exists to avoid. the row
    // is a `display: contents` pass-through: the enclosing .forecastViz_form grid is what lines the columns up. the
    // `form-select` classes are only cosmetic, so they degrade to a plain <SELECT> harmlessly
    function _createFormRow(selectId, label) {
        return $(
            `<div class="forecastViz_form_row">\n` +
            `    <label for="${selectId}">${label}:</label>\n` +
            `    <select id="${selectId}" class="form-select form-select-sm"></select>\n` +
            `</div>`)
    }


    //
    // make $optionsDiv (left column)
    //
    // NB: `col-md-N` must stay the FIRST class here and on $vizDiv below. consumers whose pages lack the Bootstrap
    // grid map these columns onto their own layout by reading the number out of the class name, with a selector
    // like `div[class^='col-md']` - prepending another class silently breaks their whole layout
    const $optionsDiv = $('<div class="col-md-3" id="forecastViz_options"></div>');

    // add Outcome, task ID, and Interval selects (form). NB: these are unfilled; their <OPTION>s are added by
    // initializeTargetVarsUI(), initializeTaskIDsUI(), and initializeIntervalsUI(), respectively
    const $optionsForm = $('<form class="forecastViz_form"></form>');
    $optionsForm.append(_createFormRow('target_variable', 'Outcome'));
    taskIdsKeys.forEach(taskIdKey => {
        $optionsForm.append(_createFormRow(taskIdKey, titleCase(taskIdKey.replace(/[_-]/g, ' '))));  // replace w/spaces
    });
    $optionsForm.append(_createFormRow('intervals', 'Interval'));
    $optionsDiv.append($optionsForm);

    // add the "Season mode (beta)" section: a header with a checkbox to its right (ala "Select Models" below),
    // followed by the two season <SELECT>s, which are only shown when season mode is on. NB: the <SELECT>s are
    // unfilled; their <OPTION>s are added by initializeSeasonsUI() and initializeSeasonStartUI(). NB: this
    // section's rule is also what fences off the Outcome/task ID/Interval group above it, which has no header
    $optionsDiv.append($(
        '<div class="forecastViz_section">\n' +
        '    <form class="d-flex flex-row align-items-center flex-wrap">\n' +
        '        <label class="forecastViz_label me-2" for="forecastViz_season_mode">Season mode (beta):</label>\n' +
        '        <input type="checkbox" id="forecastViz_season_mode">\n' +
        '    </form>\n' +
        '</div>'));
    const $seasonControlsDiv = $('<div id="forecastViz_season_controls" class="ms-3" style="display: none"></div>');
    const $seasonForm = $('<form class="forecastViz_form"></form>');
    $seasonForm.append(_createFormRow('season', 'Season'));
    $seasonForm.append(_createFormRow('season_start', 'Season start'));
    $seasonControlsDiv.append($seasonForm);
    $optionsDiv.append($seasonControlsDiv);

    // add truth checkboxes. NB: the "as of" one is listed first and is the darkest b/c it's the one the left/right
    // navigation changes. the third one only applies in season mode and is therefore hidden when that's off. the
    // labels themselves are set by updateTruthCheckboxLabels(), which varies them by mode
    // NB: each one's text is a <LABEL for> rather than a <SPAN> so that clicking the text toggles the checkbox, ala
    // the model list below. the colored dots stay outside the labels, also ala the model list
    const $truthCheckboxesDiv = $(
        '<div class="form-group form-check forecastViz_select_data ">\n' +
        '    <input title="target as of" type="checkbox" id="forecastViz_Truth_as_of" value="Target as of" checked>\n' +
        '      &nbsp;<label for="forecastViz_Truth_as_of" class="form-check-label" id="asOfTruthDate">(as of truth date here)</label>\n' +
        '      &nbsp;<span class="forecastViz_dot" style="background-color: black;"></span>\n' +
        '    <br>\n' +
        '    <input title="curr target" type="checkbox" id="forecastViz_Current_Truth" value="Current Target" checked>\n' +
        '      &nbsp;<label for="forecastViz_Current_Truth" class="form-check-label" id="currentTruthDate">Current (current target date here)</label>\n' +
        '      &nbsp;<span class="forecastViz_dot" style="background-color: darkgray; "></span>\n' +
        '    <span id="forecastViz_other_seasons_row" style="display: none">\n' +
        '        <br>\n' +
        '        <input title="other seasons" type="checkbox" id="forecastViz_Other_Seasons" value="Other Seasons" checked>\n' +
        '          &nbsp;<label for="forecastViz_Other_Seasons" class="form-check-label">Other seasons, current data</label>\n' +
        '          &nbsp;<span class="forecastViz_dot" style="background-color: lightgray;"></span>\n' +
        '    </span>\n' +
        '</div>');
    $optionsDiv.append('<div class="forecastViz_section forecastViz_label">Select Target Data:</div>');
    $optionsDiv.append($truthCheckboxesDiv);

    // add model list controls
    $optionsDiv.append($(
        '<div class="forecastViz_section">\n' +
        '    <form class="d-flex flex-row align-items-center flex-wrap">\n' +
        '        <label class="forecastViz_label me-2" for="forecastViz_all">Select Models:</label>\n' +
        '        <input type="checkbox" id="forecastViz_all">\n' +
        '            <button type="button" class="btn btn-light btn-sm rounded-pill ms-auto" id="forecastViz_shuffle">\n' +
        '                Shuffle Colours\n' +
        '            </button>\n' +
        '    </form>\n' +
        '</div>'));

    // add the model list itself
    $optionsDiv.append($('<div id="forecastViz_select_model"></div>'));


    //
    // make $vizDiv (right column)
    //
    const $vizDiv = $('<div class="col-md-9" id="forecastViz_viz"></div>');  // NB: `col-md-N` first - see $optionsDiv
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


/**
 * Shows a modal dialog with a close button.
 *
 * @param {String} title
 * @param {String} message
 */
function showDialog(title, message) {
    console.info(`flashMessage(): ${message}`);
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
// interval support
//

/**
 * Maps the `intervals` option values that we can plot to the [lower, upper] forecast data keys backing them. A central
 * interval of width W uses the quantile levels (1 - W) / 2 and 1 - (1 - W) / 2, so e.g. 80% -> 0.1 and 0.9. '0%' is the
 * degenerate case - it has no bounds, so only the median line is plotted, which is also what happens for any interval
 * that's not a key here. NB: the counterpart to this table on the data generation side is
 * hub-dashboard-predtimechart's `intervals.py`.
 */
const INTERVAL_TO_QUANTILE_KEYS = {
    '50%': ['q0.25', 'q0.75'],
    '80%': ['q0.1', 'q0.9'],
    '95%': ['q0.025', 'q0.975'],
};


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
        task_ids: {},
        intervals: [],
        available_as_ofs: {},
        current_date: "",
        models: [],
        modelUrls: {},
        disclaimer: "",

        // Dynamic/updated data, used to track 2 categories:
        // 1/2 Tracks UI state:
        selected_target_var: '',
        selected_interval: '',
        selected_as_of_date: '',
        selected_truth: ['Current Target', 'Target as of', 'Other Seasons'],
        selected_models: [],
        last_selected_models: [],  // last manually-selected models. used by "Select Models" checkbox
        colors: [],
        initial_xaxis_range: null,  // initialize() option
        initial_yaxis_range: null,  // ""

        // season mode state. season mode is off by default, in which case the app behaves as it did before season mode
        // was added: one plot of all the data, with no other seasons behind it
        is_season_mode: false,
        season_start_month: DEFAULT_SEASON_START_MONTH,  // 1-based month a season starts in. "Season start" <SELECT>
        selected_season_start_year: null,  // the selected season, ala seasonStartYear(). "Season" <SELECT>
        plotted_season_start_year: null,  // the season updatePlot() last set the xaxis range to

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
        let isAsOfFromURL = false;  // true if the URL is where `initial_as_of` ends up coming from
        const optionsFromURL = getOptionsFromURL(options['task_ids'], window.location.search);
        if (Object.keys(optionsFromURL).length !== 0) {
            const mergedOptions = {...options, ...optionsFromURL}  // NB: second overrides first
            try {
                _validateOptions(mergedOptions);
                console.debug('initialize(): merged options are valid');
                options = mergedOptions;
                isAsOfFromURL = optionsFromURL.hasOwnProperty('initial_as_of');
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
        this.state.modelUrls = options.hasOwnProperty('model_urls') ? options['model_urls'] : {};
        this.state.disclaimer = options['disclaimer'];  // undefined if not present
        this.state.colors = Array(parseInt(this.state.models.length / 10, 10) + 1).fill([
            // Tableau 10 color palette
            '#4E79A7',  // Blue
            '#F28E2B',  // Orange
            '#E15759',  // Red
            '#76B7B2',  // Teal
            '#59A14F',  // Green
            '#EDC948',  // Yellow
            '#B07AA1',  // Purple
            '#FF9DA7',  // Pink
            '#9C755F',  // Brown
            '#BAB0AC'   // Gray
        ]).flat()
        this.state.initial_xaxis_range = options.hasOwnProperty('initial_xaxis_range') ? options['initial_xaxis_range'] : null;
        this.state.initial_yaxis_range = options.hasOwnProperty('initial_yaxis_range') ? options['initial_yaxis_range'] : null;

        // save initial selected state
        this.state.selected_target_var = options['initial_target_var'];
        this.state.selected_interval = options['initial_interval'];
        this.state.selected_as_of_date = options['initial_as_of'];
        // this.state.selected_truth: synchronized via default <input ... checked> setting
        this.state.selected_models = options['initial_checked_models'];

        // save initial season mode state. NB: we always set these (rather than leaving whatever's there) b/c `App`
        // is a singleton that can be initialized more than once. `selected_season_start_year` is resolved just below
        this.state.is_season_mode = options.hasOwnProperty('initial_season_mode')
            ? options['initial_season_mode'] : false;
        this.state.season_start_month = options.hasOwnProperty('initial_season_start_month')
            ? options['initial_season_start_month'] : DEFAULT_SEASON_START_MONTH;
        this.state.plotted_season_start_year = null;
        this._initializeSeasonState(options, isAsOfFromURL);

        // populate UI elements, setting selection state to initial
        console.debug('initialize(): initializing UI');
        const $componentDiv = $(componentDivEle);
        const isDisclaimerPresent = options.hasOwnProperty('disclaimer');

        // use an arbitrary task_ids target_variables.value b/c task_id keys all are the same (App caller validates)
        const taskIdsKey = Object.keys(this.state.task_ids)[0];
        const taskIdsKeys = Object.keys(this.state.task_ids[taskIdsKey]);
        _createUIElements($componentDiv, taskIdsKeys, isDisclaimerPresent);

        this.initializeUI(options['task_ids'], options['initial_target_var'], options['initial_task_ids'], isDisclaimerPresent);

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
     * @returns {URL} a URL for the current window location whose search params capture the app's shareable state.
     *   Split out from showOptionsInURL() so that the params can be tested without touching window.history
     */
    optionsURL() {
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

        // season mode params. NB: we only add these when season mode is on - o/w they'd be noise in every URL, and
        // off is the default anyway. this does mean a non-default "Season start" isn't captured by a URL copied
        // while season mode is off
        if (this.state.is_season_mode) {
            newUrl.searchParams.append("season_mode", "true");
            if (this.state.selected_season_start_year !== null) {
                newUrl.searchParams.append("season", this.state.selected_season_start_year);
            }
            newUrl.searchParams.append("season_start", this.state.season_start_month);
        }

        return newUrl;
    },
    showOptionsInURL() {
        const newUrl = this.optionsURL();

        // following is to prevent browser history errors resulting from calling `replaceState()` too many times, e.g.,
        // in Firefox: "Too many calls to Location or History APIs within a short timeframe."
        if ((window.history.state === null) || (newUrl.toString() !== window.history.state.toString())) {
            window.history.replaceState(newUrl.toString(), '', newUrl);
        }
    },
    initializeUI(taskIDs, initialTargetVar, initialTaskIDs, isDisclaimerPresent) {
        // populate options and models list (left column)
        this.initializeTargetVarsUI();
        this.initializeTaskIDsUI(taskIDs, initialTargetVar, initialTaskIDs);
        this.initializeIntervalsUI();
        this.updateModelsList();

        // initialize the season controls. NB: they're hidden until season mode is turned on, but we fill them in now
        // so that turning it on has something to show. `state.selected_season_start_year` was resolved by
        // initialize() -> _initializeSeasonState()
        this.initializeSeasonStartUI();
        this.initializeSeasonsUI();

        // initialize truth checkboxes' text and the season mode-only controls' visibility
        this.updateSeasonModeUI();

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
            const availableAsOfs = App.asOfsInSelectedSeason();  // stays within the season when in season mode
            const closestAsOf = closestYear(pickedDate, availableAsOfs);

            // reset picked date to today (o/w stays on picked date)
            picker.setStartDate(new Date());
            picker.setEndDate(new Date());

            // go to picked date if different from current
            if (closestAsOf !== App.state.selected_as_of_date) {
                App.state.selected_as_of_date = closestAsOf;
                App.fetchDataUpdatePlot(true, false);
                App.updateTruthCheckboxLabels();
                App.updateSeasonNavState();
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
    initializeTaskIDsUI(taskIDs, targetVar, taskIds) {
        // populate task ID-related <SELECT>s
        Object.keys(taskIDs[targetVar]).forEach(function (taskIdKey) {
            const $taskIdSelect = $(`#${taskIdKey}`);  // created by _createUIElements()
            $taskIdSelect.empty();
            const taskIdValueObjs = taskIDs[targetVar][taskIdKey];
            taskIdValueObjs.forEach(taskIdValueObj => {
                const selected = taskIdValueObj.value === taskIds[taskIdKey] ? 'selected' : '';
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
    /**
     * Populates the "Season start" <SELECT> with the 12 months, selecting `state.season_start_month`.
     */
    initializeSeasonStartUI() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
            'October', 'November', 'December'];
        const $seasonStartSelect = $("#season_start");
        const thisState = this.state;
        $seasonStartSelect.empty();
        monthNames.forEach(function (monthName, monthIdx) {
            const month = monthIdx + 1;  // monthIdx -> 1-based month
            const selected = month === thisState.season_start_month ? 'selected' : '';
            $seasonStartSelect.append(`<option value="${month}" ${selected} >${monthName}</option>`);
        });
    },
    /**
     * Populates the "Season" <SELECT> with the seasons present in the selected target variable's `available_as_ofs`,
     * newest first, selecting `state.selected_season_start_year`. NB: we use `available_as_ofs` rather than the truth
     * data so that every season that can be selected is one that can actually be navigated to - it has as_of dates, and
     * therefore forecasts and as_of truth. Seasons that only the truth data reaches back to are still drawn as "other
     * seasons" curves; they just can't be selected.
     */
    initializeSeasonsUI() {
        const $seasonsSelect = $("#season");
        const thisState = this.state;
        $seasonsSelect.empty();
        this.availableSeasonStartYears().reverse().forEach(function (startYear) {  // newest first
            const selected = startYear === thisState.selected_season_start_year ? 'selected' : '';
            const seasonText = seasonName(startYear, thisState.season_start_month);
            $seasonsSelect.append(`<option value="${startYear}" ${selected} >${seasonText}</option>`);
        });
    },
    /**
     * @returns {Array} the starting years of the seasons the selected target variable has as_of dates for, ascending.
     *   [] if there are no as_of dates
     */
    availableSeasonStartYears() {
        const availableAsOfs = this.state.available_as_ofs[this.state.selected_target_var];
        return seasonsInDates(availableAsOfs, this.state.season_start_month);
    },
    /**
     * initialize() helper that resolves `state.selected_season_start_year` and, when the season was picked
     * explicitly, `state.selected_as_of_date`.
     *
     * The as_of date and the season can disagree - a hand-edited URL, say, or a consumer passing an
     * `initial_season` from a different season than its `initial_as_of`. The rule: an as_of date that came from the
     * URL is the most specific thing the user asked for, so it wins and the season is derived from it. O/w an
     * explicit `initial_season` wins and we move to that season's first as_of date, ala picking a season from the
     * "Season" <SELECT>. NB: `initial_season` only applies in season mode - there's no season to be in when it's off
     *
     * @param options {Object} ala initialize()'s `options`, already merged with any valid URL options
     * @param isAsOfFromURL {Boolean} true if `options['initial_as_of']` came from the URL rather than the caller
     * @private
     */
    _initializeSeasonState(options, isAsOfFromURL) {
        const state = this.state;
        const initialSeason = options.hasOwnProperty('initial_season') ? options['initial_season'] : null;
        if (!state.is_season_mode || (initialSeason === null) || isAsOfFromURL) {
            if ((initialSeason !== null) && isAsOfFromURL
                && (initialSeason !== seasonStartYear(state.selected_as_of_date, state.season_start_month))) {
                console.warn(`initialize(): ignoring initial_season=${initialSeason} b/c it disagrees with the as_of `
                    + `date from the URL (${state.selected_as_of_date})`);
            }
            state.selected_season_start_year = this.defaultSeasonStartYear();
            return;
        }

        // the season was picked explicitly -> honor it, moving to its first as_of date
        state.selected_season_start_year = initialSeason;
        const seasonAsOfs = this.asOfsInSelectedSeason();
        if (seasonAsOfs.length !== 0) {
            state.selected_as_of_date = seasonAsOfs[0];
        }
    },
    /**
     * @returns {Number} the season that `state.selected_as_of_date` falls in, falling back to the newest season that
     *   has as_of dates. null if neither is available
     */
    defaultSeasonStartYear() {
        if (this.state.selected_as_of_date) {
            return seasonStartYear(this.state.selected_as_of_date, this.state.season_start_month);
        }

        const startYears = this.availableSeasonStartYears();
        return (startYears.length === 0) ? null : startYears[startYears.length - 1];
    },
    /**
     * @returns {Array} the selected target variable's as_of dates that fall in the selected season, ascending. all of
     *   them if not in season mode or if no season is selected
     */
    asOfsInSelectedSeason() {
        const state = this.state;
        const availableAsOfs = state.available_as_ofs[state.selected_target_var];
        if (!state.is_season_mode || (state.selected_season_start_year === null)) {
            return availableAsOfs;
        }

        return availableAsOfs.filter((asOf) =>
            seasonStartYear(asOf, state.season_start_month) === state.selected_season_start_year);
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
                const modelUrl = model in thisState.modelUrls ? thisState.modelUrls[model] : null;
                const isChecked = (thisState.selected_models.indexOf(model) > -1);
                const modelIdx = thisState.models.indexOf(model);
                $selectModelDiv.append(_selectModelDiv(model, modelUrl, thisState.colors[modelIdx], true, isChecked));
            });

        // 2. add models without forecasts
        this.state.models
            .filter(function (model) {
                return !App.state.forecasts.hasOwnProperty(model);
            })
            .forEach(function (model) {
                const modelUrl = model in thisState.modelUrls ? thisState.modelUrls[model] : null;
                const isChecked = (thisState.selected_models.indexOf(model) > -1);
                $selectModelDiv.append(_selectModelDiv(model, modelUrl, 'grey', false, isChecked));
            });

        // re-wire up model checkboxes
        this.addModelCheckEventHandler();
    },
    addEventHandlers() {
        // option, task ID, and interval selects
        $('#target_variable').on('change', function () {
            App.state.selected_target_var = this.value;
            App.initializeTaskIDsUI(App.state.task_ids, App.state.selected_target_var,
                App.state.task_ids[App.state.selected_target_var]);
            App.syncSelectedSeason();  // b/c `available_as_ofs` - and therefore the seasons - is per target variable
            App.fetchDataUpdatePlot(true, true);
            App.showOptionsInURL();
        });
        Object.keys(App.state.task_ids[App.state.selected_target_var]).forEach(function (taskIdKey) {
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

        // "Season mode (beta)" checkbox. NB: no fetch is needed - season mode is purely a matter of how the data
        // we already have is plotted
        $("#forecastViz_season_mode").change(function () {
            // NB: we leave `plotted_season_start_year` alone so that updatePlot() can tell a season going away (off)
            // from one arriving (on), and set the xaxis range accordingly
            App.state.is_season_mode = $(this).prop('checked');
            App.syncSelectedSeason();
            App.updateSeasonModeUI();
            App.updatePlot(true);
            App.showOptionsInURL();
        });

        // "Season" select
        $('#season').on('change', function () {
            App.state.selected_season_start_year = parseInt(this.value);

            // move to the season's first as_of date so that picking a season starts you at the top of it. NB: this
            // differs from the initial page load, which stays on the caller's `initial_as_of` - typically the most
            // recent forecast of the most recent season
            const seasonAsOfs = App.asOfsInSelectedSeason();
            if ((seasonAsOfs.length !== 0) && (seasonAsOfs[0] !== App.state.selected_as_of_date)) {
                App.state.selected_as_of_date = seasonAsOfs[0];
                App.updateTruthCheckboxLabels();
                App.updateSeasonNavState();
                App.fetchDataUpdatePlot(true, false);  // current truth is keyed on `current_date` -> no need to refetch
                App.showOptionsInURL();
            } else {
                App.updateSeasonNavState();
                App.updatePlot(true);
                App.showOptionsInURL();
            }
        });

        // "Season start" select. changing it moves the season boundaries, so the season list has to be rebuilt
        $('#season_start').on('change', function () {
            App.state.season_start_month = parseInt(this.value);
            // the season's start year can stay the same while its extent moves, so force updatePlot() to re-apply it
            App.state.plotted_season_start_year = null;
            App.syncSelectedSeason();
            App.updatePlot(true);
            App.showOptionsInURL();
        });

        // truth checkboxes
        $("#forecastViz_Current_Truth").change(function () {
            _setSelectedTruths();
        });
        $("#forecastViz_Truth_as_of").change(function () {
            _setSelectedTruths();
        });
        $("#forecastViz_Other_Seasons").change(function () {
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
        this._moveAsOf(1);
    },
    decrementAsOf() {
        this._moveAsOf(-1);
    },
    /**
     * incrementAsOf()/decrementAsOf() helper that moves `state.selected_as_of_date` by `offset` as_of dates. In season
     * mode we only move within the selected season, so the ends of a season are hard stops.
     *
     * @param offset {Number} number of as_of dates to move by. negative moves back in time
     * @private
     */
    _moveAsOf(offset) {
        const state = this.state;
        const asOfs = this.asOfsInSelectedSeason();  // all of them if not in season mode
        const asOfIdx = asOfs.indexOf(state.selected_as_of_date);
        const newAsOfIdx = asOfIdx + offset;
        if ((asOfIdx === -1) || (newAsOfIdx < 0) || (newAsOfIdx > asOfs.length - 1)) {
            return;  // at (or outside) the end of what we can navigate
        }

        state.selected_as_of_date = asOfs[newAsOfIdx];
        this.fetchDataUpdatePlot(true, false);
        this.updateTruthCheckboxLabels();
        this.updateSeasonNavState();
        this.showOptionsInURL();
    },
    /**
     * Sets the "Select Target Data" checkbox labels, which differ by mode: outside season mode there is no selected
     * season to name, and the "other seasons" checkbox doesn't apply at all.
     */
    updateTruthCheckboxLabels() {
        const state = this.state;
        const asOfText = `As of data ${state.selected_as_of_date}`;
        const currentText = `Current data (${state.current_date})`;
        $("#asOfTruthDate").text(state.is_season_mode ? `Selected season, ${asOfText.toLowerCase()}` : asOfText);
        $("#currentTruthDate").text(state.is_season_mode ? `Selected season, ${currentText.toLowerCase()}` : currentText);
    },
    /**
     * Shows or hides the season mode-only controls to match `state.is_season_mode`.
     */
    updateSeasonModeUI() {
        const isSeasonMode = this.state.is_season_mode;
        $("#forecastViz_season_mode").prop('checked', isSeasonMode);  // a no-op when the checkbox is what changed
        $("#forecastViz_season_controls").toggle(isSeasonMode);
        $("#forecastViz_other_seasons_row").toggle(isSeasonMode);
        this.updateTruthCheckboxLabels();
        this.updateSeasonNavState();
    },
    /**
     * In season mode, disables the left/right buttons at the selected season's first and last as_of dates so that the
     * season boundary is visibly a hard stop. Outside season mode the buttons are always enabled, ala before season
     * mode was added.
     */
    updateSeasonNavState() {
        if (!this.state.is_season_mode) {
            $("#decrement_as_of").prop('disabled', false);
            $("#increment_as_of").prop('disabled', false);
            return;
        }

        const asOfs = this.asOfsInSelectedSeason();
        const asOfIdx = asOfs.indexOf(this.state.selected_as_of_date);
        $("#decrement_as_of").prop('disabled', (asOfIdx <= 0));
        $("#increment_as_of").prop('disabled', ((asOfIdx === -1) || (asOfIdx >= asOfs.length - 1)));
    },
    /**
     * Rebuilds the "Season" <SELECT> and makes sure the selected season and as_of date agree with each other. Called
     * whenever something that determines the available seasons changes: the target variable, the season start month,
     * or season mode itself.
     */
    syncSelectedSeason() {
        const state = this.state;
        state.selected_season_start_year = this.defaultSeasonStartYear();  // the season `selected_as_of_date` is in
        this.initializeSeasonsUI();

        // the as_of date drives the season above, so it's already in the season. but it can be outside the available
        // as_ofs entirely (a target variable change, say), in which case we move to the nearest available one
        const asOfs = this.asOfsInSelectedSeason();
        if ((asOfs.length !== 0) && (asOfs.indexOf(state.selected_as_of_date) === -1)) {
            state.selected_as_of_date = closestYear(state.selected_as_of_date, asOfs);
        }
        this.updateTruthCheckboxLabels();
        this.updateSeasonNavState();
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
        Object.keys(this.state.task_ids[this.state.selected_target_var]).forEach(taskIdKey => {
            const $taskIdSelect = $(`#${taskIdKey}`);  // created by _createUIElements()
            const selectedTaskIdValue = $taskIdSelect.val();
            const taskIdObj = App.state.task_ids[this.state.selected_target_var][taskIdKey]
                .find(taskID => taskID['value'] === selectedTaskIdValue);
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
     * @param isFetchFirst true if the function should fetch before plotting. false if no fetch
     * @param isFetchCurrentTruth applies if `isFetchFirst`: controls whether current truth is fetched in addition to
     *   as_of truth and forecasts. ignored if not isFetchFirst
     */
    fetchDataUpdatePlot(isFetchFirst, isFetchCurrentTruth) {
        console.debug(`fetchDataUpdatePlot(${isFetchFirst}, ${isFetchCurrentTruth}): entered`);
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

        // save current xaxis and yaxis ranges (if available) before updating the plot so that we can relayout() using
        // them if need be. NB: the default xaxis.range seems to be [-1, 6] when updating for the first time
        // (yaxis.range = [-1, 4]). there might be a better way to determine this.
        let currXAxisRange, currYAxisRange, isXAxisRangeDefault, isYAxisRangeDefault;
        const isExistingData = plotyDiv.data.length !== 0;
        if (isExistingData) {  // o/w plotyDiv.layout.* is undefined
            currXAxisRange = plotyDiv.layout.xaxis.range;
            currYAxisRange = plotyDiv.layout.yaxis.range;
            isXAxisRangeDefault = ((currXAxisRange.length === 2) && (currXAxisRange[0] === -1) && (currXAxisRange[1] === 6));
            isYAxisRangeDefault = ((currYAxisRange.length === 2) && (currYAxisRange[0] === -1) && (currYAxisRange[1] === 4));
        }

        // current xaxis and yaxis ranges are saved, so do the plot
        Plotly.react(plotyDiv, data, layout);  // xaxis.range and yaxis.range are set next

        // compute xaxis.range and yaxis.range, factoring in whether there's existing data (and therefore an existing
        // layout) and then do relayout()
        const relayoutUpdate = {};  // passed to relayout(). filled next

        // in season mode we plot one season at a time, so the xaxis range is the season's, not the data's or the
        // caller's `initial_xaxis_range`. NB: we only force it when the season changes so that zooming within a season
        // isn't undone by every replot (selecting a model, say)
        const refStartYear = this.state.is_season_mode ? this.referenceSeasonStartYear() : null;
        const isNewSeason = refStartYear !== this.state.plotted_season_start_year;
        const isLeavingSeason = isNewSeason && (refStartYear === null);  // a season was plotted, but none is now
        this.state.plotted_season_start_year = refStartYear;

        if (isNewSeason && (refStartYear !== null)) {
            relayoutUpdate['xaxis.range'] = seasonDateRange(refStartYear, this.state.season_start_month);
            if (!isResetYLimit && isExistingData && !isYAxisRangeDefault) {
                relayoutUpdate['yaxis.range'] = currYAxisRange;
            }
        } else if (isExistingData) {
            // above plotyDiv.layout.* is NOT undefined -> can use currXAxisRange, ...
            // NB: when leaving season mode, currXAxisRange is the season's, which we set above - not a zoom to keep
            if (!isXAxisRangeDefault && !isLeavingSeason) {
                relayoutUpdate['xaxis.range'] = currXAxisRange;
            } else if (this.state.initial_xaxis_range != null) {
                relayoutUpdate['xaxis.range'] = this.state.initial_xaxis_range;
            } else if (isLeavingSeason) {
                relayoutUpdate['xaxis.autorange'] = true;
            }

            if (!isResetYLimit) {
                if (!isYAxisRangeDefault) {
                    relayoutUpdate['yaxis.range'] = currYAxisRange;
                } else if (this.state.initial_yaxis_range != null) {
                    relayoutUpdate['yaxis.range'] = this.state.initial_yaxis_range;
                }
            }
        } else {
            // above plotyDiv.layout.* is undefined so set xaxis.range and yaxis.range to initial_xaxis_range and
            // initial_yaxis_range if they're not null
            if (this.state.initial_xaxis_range != null) {
                relayoutUpdate['xaxis.range'] = this.state.initial_xaxis_range;
            }

            if (this.state.initial_yaxis_range != null) {
                relayoutUpdate['yaxis.range'] = this.state.initial_yaxis_range;
            }
        }
        Plotly.relayout(plotyDiv, relayoutUpdate);

        // call initializeDateRangePicker() b/c jquery binding is apparently lost with any Plotly.*() call
        this.initializeDateRangePicker();
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
                // in season mode the plot is one season wide, so the range slider isn't needed to find your way
                // around a long time series and its default height is mostly wasted. make it about half as tall
                rangeslider: this.state.is_season_mode ? {thickness: 0.07} : {},
            },
            yaxis: {
                title: {text: variable},
                fixedrange: false
            }
        }
    },
    /**
     * @returns {Number} the starting year of the season currently being viewed - the one selected in the "Season"
     *   <SELECT>, falling back to the selected as_of date's and then to that of the latest date in
     *   `state.current_truth`. null if none is available
     */
    referenceSeasonStartYear() {
        const state = this.state;
        if (state.selected_season_start_year !== null) {
            return state.selected_season_start_year;
        } else if (state.selected_as_of_date) {
            return seasonStartYear(state.selected_as_of_date, state.season_start_month);
        }

        const dates = (state.current_truth == null) ? null : state.current_truth.date;
        return (Array.isArray(dates) && (dates.length !== 0))
            ? seasonStartYear(dates[dates.length - 1], state.season_start_month) : null;
    },
    /**
     * getPlotlyData() helper that returns the "Other seasons, current data" curves: one light gray line per season in
     * `state.current_truth` other than the one currently being viewed, with each one's dates shifted by whole years so
     * that it overlays the selected season. Both earlier and later seasons are included, so selecting an old season
     * still shows the ones that followed it. Each trace's tooltip is just its season name, e.g., '2022-2023'.
     *
     * @returns {Array} Plotly traces, oldest season first. [] if not in season mode, if the "Other seasons, current
     *   data" checkbox is unchecked, or if there's no other season's truth data
     */
    getSeasonalTruthTraces() {
        const state = this.state;
        const refStartYear = this.referenceSeasonStartYear();
        if (!state.is_season_mode || !state.selected_truth.includes('Other Seasons') || (refStartYear === null)) {
            return [];
        }

        return splitTruthBySeason(state.current_truth, state.season_start_month)
            .filter((seasonChunk) => seasonChunk.startYear !== refStartYear)
            .map((seasonChunk) => {
                const numYears = refStartYear - seasonChunk.startYear;  // negative for seasons after the selected one
                return {
                    x: seasonChunk.date.map((dateStr) => shiftDateStrByYears(dateStr, numYears)),
                    y: seasonChunk.y,
                    type: 'scatter',
                    mode: 'lines',
                    name: seasonChunk.season,
                    line: {color: 'lightgray', width: 1},
                    hovertemplate: `<b>${seasonChunk.season}</b><extra></extra>`
                };
            });
    },
    getPlotlyData() {
        const state = this.state;
        let pd = [];

        // in season mode - ala the old FluSight Network site - we plot one season at a time: the truth is trimmed to
        // the selected season, and the other seasons are overlaid on it by getSeasonalTruthTraces() below. o/w we plot
        // all the truth we have, as we did before season mode was added
        const refStartYear = this.referenceSeasonStartYear();
        const isSeasonMode = state.is_season_mode;
        const currentTruth = isSeasonMode
            ? filterTruthToSeason(state.current_truth, refStartYear, state.season_start_month) : state.current_truth;
        const asOfTruth = isSeasonMode
            ? filterTruthToSeason(state.as_of_truth, refStartYear, state.season_start_month) : state.as_of_truth;
        const currentTruthName = isSeasonMode ? 'Selected season, current data' : 'Current Target';
        const asOfTruthName = isSeasonMode
            ? `Selected season, as of data ${state.selected_as_of_date}` : `Target as of ${state.selected_as_of_date}`;

        if (state.selected_truth.includes('Current Target') && _hasTruthPoints(currentTruth)) {
            pd.push({
                x: currentTruth.date,
                y: currentTruth.y,
                type: 'scatter',
                mode: 'lines',
                name: currentTruthName,
                marker: {color: 'darkgray'},
                hovertemplate: `<b>${currentTruthName}</b><br>` +
                    `Date: %{x}<br>` +
                    `Value: %{y:,.2~f}` +
                    `<extra></extra>`
            })
        }
        if (state.selected_truth.includes('Target as of') && _hasTruthPoints(asOfTruth)) {
            pd.push({
                x: asOfTruth.date,
                y: asOfTruth.y,
                type: 'scatter',
                mode: 'lines',
                name: asOfTruthName,
                marker: {color: 'black'},
                hovertemplate: `<b>${asOfTruthName}</b><br>` +
                    `Date: %{x}<br>` +
                    `Value: %{y:,.2~f}` +
                    `<extra></extra>`
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

                    // 1-3: sort model forecasts in order of target end date. NB: we sort *every* quantile key that's
                    // present rather than a fixed set, so that optional ones (e.g., the q0.1/q0.9 backing the 80%
                    // interval) stay aligned with target_end_date
                    const quantileKeys = Object.keys(model_forecasts).filter((key) => key !== 'target_end_date')

                    // 1) combine the arrays:
                    const list = date.map((dateStr, j) => ({
                        date: dateStr,
                        quantileValues: quantileKeys.map((quantileKey) => model_forecasts[quantileKey][j])
                    }))

                    // 2) sort:
                    list.sort((a, b) => (moment(a.date).isBefore(b.date) ? -1 : 1))

                    // 3) separate them back out:
                    list.forEach((item, k) => {
                        model_forecasts.target_end_date[k] = item.date
                        quantileKeys.forEach((quantileKey, q) => {
                            model_forecasts[quantileKey][k] = item.quantileValues[q]
                        })
                    })

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

                    // determine the quantile keys backing the selected interval. we plot a band only if the selected
                    // interval is one we know how to map AND this model actually submitted both backing quantiles -
                    // e.g., a model that didn't submit q0.1/q0.9 gets no 80% band, same as the '0%' option
                    const [lower_quantile, upper_quantile] = INTERVAL_TO_QUANTILE_KEYS[state.selected_interval] ?? []
                    const hasInterval = (lower_quantile !== undefined) &&
                        (model_forecasts[lower_quantile] !== undefined) &&
                        (model_forecasts[upper_quantile] !== undefined)

                    // build customdata and hovertemplate for tooltip
                    const customdata = hasInterval
                        ? model_forecasts.target_end_date.map((_, i) => [
                            model_forecasts[lower_quantile][i],
                            model_forecasts[upper_quantile][i]
                        ])
                        : null
                    const hovertemplate = hasInterval
                        ? `<b>${model}</b><br>` +
                          `Date: %{x}<br>` +
                          `Value: %{y:,.2~f}<br>` +
                          `${state.selected_interval} PI: [%{customdata[0]:,.2~f}, %{customdata[1]:,.2~f}]` +
                          `<extra></extra>`
                        : `<b>${model}</b><br>` +
                          `Date: %{x}<br>` +
                          `Value: %{y:,.2~f}` +
                          `<extra></extra>`

                    const plot_line = {
                        // point forecast
                        x: model_forecasts.target_end_date,
                        y: model_forecasts['q0.5'],
                        type: 'scatter',
                        name: model,
                        opacity: 0.7,
                        mode,
                        line: {color: state.colors[index]},
                        customdata,
                        hovertemplate
                    }

                    if (!hasInterval) {
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
                            // interval forecast -- the band for `state.selected_interval`
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

        // prepend the other seasons' curves so that they're drawn behind everything else. [] when not in season mode
        pd = this.getSeasonalTruthTraces().concat(pd)

        // done!
        return pd
    },
};


export default App;  // export the module's main entry point
