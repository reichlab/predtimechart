/**
 *
 * @param year {String} date in 'YYYY-MM-DD' format
 * @param availableYears {Array} dates in 'YYYY-MM-DD' format
 * @returns {String} the date in `availableYears` that's closest to `year` ('YYYY-MM-DD' format)
 */
function closestYear(year, availableYears) {
    if (availableYears.length === 0) {
        throw new Error(`availableYears is empty`);
    } else if (availableYears.indexOf(year) !== -1) {  // already in availableYears
        return year;
    }

    // create availableYears as Date objects and then iterate, comparing each with `year` as a Date and tracking the one
    // with the minimum offset. no need to sort
    const yearAsDate = _parseYYYYMMDDStr(year);
    const availYearsDates = availableYears.map(availYear => _parseYYYYMMDDStr(availYear));
    let closestAvailYearDate = null;  // Date
    availYearsDates.forEach(availYearDate => {
        const closestAvailYearDelta = closestAvailYearDate === null ? null : Math.abs(closestAvailYearDate - yearAsDate);
        const availYearDelta = Math.abs(availYearDate - yearAsDate);
        if ((closestAvailYearDate === null) || (availYearDelta < closestAvailYearDelta)) {
            closestAvailYearDate = availYearDate;
        }
    });

    // done
    return closestAvailYearDate.toISOString().split('T')[0];  // convert to 'YYYY-MM-DD' format
}


/**
 * @param year {String} date in 'YYYY-MM-DD' format
 * @returns {Date} `year` as a Date object
 * @private
 */
function _parseYYYYMMDDStr(year) {
    // month -1 -> monthIndex
    return new Date(parseInt(year.slice(0, 4)), parseInt(year.slice(5, 7)) - 1, parseInt(year.slice(8, 10)));
}


/**
 * App.initialize() helper that returns an object like that function's `options` object, but filled with values from
 * the current window location. Does not check for missing parameters.
 *
 * @param {Object} taskIDs - as passed to initialize()'s options['task_ids']
 * @param {String} windowLocationSearch - ala `window.location.search`
 * @returns {Object}
 */
function getOptionsFromURL(taskIDs, windowLocationSearch) {
    const options = {};
    const searchParams = new URLSearchParams(windowLocationSearch)
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

    if (('initial_target_var' in options) && (options['initial_target_var'] in taskIDs)) {
        const initial_task_ids = {}; // NB: these are `value`s, not `text`s
        Object.keys(taskIDs[options['initial_target_var']]).forEach(function (taskIdKey) {
            if (searchParams.get(taskIdKey)) {
                initial_task_ids[taskIdKey] = searchParams.get(taskIdKey);
            }
        });
        if (Object.keys(initial_task_ids).length !== 0) {
            options['initial_task_ids'] = initial_task_ids;
        }
    }

    return options;
}


// export

export {closestYear, getOptionsFromURL}
