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


/**
 * The 1-based month a season starts in when the consumer hasn't chosen otherwise. August (8) means seasons run
 * August 1 through July 31 of the following year.
 */
const DEFAULT_SEASON_START_MONTH = 8;


/**
 * The `startMonth` arg accepted by the season functions below is a 1-based month (1 = January ... 12 = December). A
 * season starts on the first of that month and ends the day before the first of that month in the following year.
 *
 * @param startMonth {Number} 1-based month, or undefined/null to get DEFAULT_SEASON_START_MONTH
 * @returns {Number} a valid 1-based month
 * @private
 */
function _validStartMonth(startMonth) {
    return ((typeof startMonth === 'number') && (startMonth >= 1) && (startMonth <= 12))
        ? startMonth : DEFAULT_SEASON_START_MONTH;
}


/**
 * @param dateStr {String} date in 'YYYY-MM-DD' format
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {Number} the starting year of the season `dateStr` falls in. e.g., for the default August start,
 *   '2022-09-03' and '2023-07-31' both return 2022, but '2022-07-31' returns 2021. NB: when `startMonth` is 1 a
 *   season is a single calendar year, so this is just `dateStr`'s year
 */
function seasonStartYear(dateStr, startMonth) {
    const theStartMonth = _validStartMonth(startMonth);
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(5, 7));  // 1-based, ala theStartMonth
    return month >= theStartMonth ? year : year - 1;
}


/**
 * @param startYear {Number} a season's starting year, ala seasonStartYear()
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {String} that season's name. a season that starts in January spans a single calendar year and is therefore
 *   named by just that year, e.g., '2025'. o/w it's named by the two years it spans, e.g., '2025-2026'
 */
function seasonName(startYear, startMonth) {
    return _validStartMonth(startMonth) === 1 ? `${startYear}` : `${startYear}-${startYear + 1}`;
}


/**
 * @param dateStr {String} date in 'YYYY-MM-DD' format
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {String} the name of the season `dateStr` falls in, e.g., '2022-2023'
 */
function seasonNameForDate(dateStr, startMonth) {
    return seasonName(seasonStartYear(dateStr, startMonth), startMonth);
}


/**
 * @param startYear {Number} a season's starting year, ala seasonStartYear()
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {Array} that season's full extent as two 'YYYY-MM-DD' dates: [the first of `startMonth`, the day before the
 *   first of `startMonth` in the following year]. e.g., 2022 with the default August start -> ['2022-08-01',
 *   '2023-07-31'], and 2022 with a January start -> ['2022-01-01', '2022-12-31']
 */
function seasonDateRange(startYear, startMonth) {
    const theStartMonth = _validStartMonth(startMonth);
    const firstDay = new Date(startYear, theStartMonth - 1, 1);  // month -1 -> monthIndex
    const lastDay = new Date(startYear + 1, theStartMonth - 1, 1);
    lastDay.setDate(lastDay.getDate() - 1);  // the day before the next season starts
    return [_formatYYYYMMDDStr(firstDay), _formatYYYYMMDDStr(lastDay)];
}


/**
 * @param dateStrs {Array} dates in 'YYYY-MM-DD' format. need not be sorted or unique
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {Array} the starting years (Numbers) of the seasons that `dateStrs` falls in, without duplicates and in
 *   ascending order. [] if `dateStrs` is empty or not an Array
 */
function seasonsInDates(dateStrs, startMonth) {
    if (!Array.isArray(dateStrs)) {
        return [];
    }

    const startYears = new Set(dateStrs.map((dateStr) => seasonStartYear(dateStr, startMonth)));
    return Array.from(startYears).sort((startYear1, startYear2) => startYear1 - startYear2);
}


/**
 * @param dateStr {String} date in 'YYYY-MM-DD' format
 * @param numYears {Number} number of years to shift by. may be negative
 * @returns {String} `dateStr` shifted by `numYears` whole years, in 'YYYY-MM-DD' format. Feb 29 rolls over to Mar 1
 *   when the target year isn't a leap year
 */
function shiftDateStrByYears(dateStr, numYears) {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(5, 7));
    const day = parseInt(dateStr.slice(8, 10));
    return _formatYYYYMMDDStr(new Date(year + numYears, month - 1, day));  // month -1 -> monthIndex
}


/**
 * Splits truth data into one chunk per season (see seasonStartYear()).
 *
 * @param truthData {Object} truth data ala _fetchData()'s truth format: {date: [...], y: [...]}
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {Array} one object per season present in `truthData`, in ascending season order, each of the form
 *   {season: '2022-2023', startYear: 2022, date: [...], y: [...]}. [] if there is no data
 */
function splitTruthBySeason(truthData, startMonth) {
    if ((truthData == null) || (!Array.isArray(truthData.date)) || (truthData.date.length === 0)) {
        return [];
    }

    const startYearToChunk = new Map();
    truthData.date.forEach((dateStr, idx) => {
        const startYear = seasonStartYear(dateStr, startMonth);
        if (!startYearToChunk.has(startYear)) {
            startYearToChunk.set(startYear,
                {season: seasonName(startYear, startMonth), startYear: startYear, date: [], y: []});
        }
        const chunk = startYearToChunk.get(startYear);
        chunk.date.push(dateStr);
        chunk.y.push(truthData.y[idx]);
    });

    return Array.from(startYearToChunk.values()).sort((chunk1, chunk2) => chunk1.startYear - chunk2.startYear);
}


/**
 * The complement of splitTruthBySeason() for a single season: returns just the `truthData` points that fall in the
 * season starting in `startYear`.
 *
 * @param truthData {Object} truth data ala _fetchData()'s truth format: {date: [...], y: [...]}
 * @param startYear {Number} a season's starting year, ala seasonStartYear()
 * @param startMonth {Number} 1-based month a season starts in. defaults to DEFAULT_SEASON_START_MONTH
 * @returns {Object} {date: [...], y: [...]} in the same order as `truthData`. Empty arrays if nothing matches
 */
function filterTruthToSeason(truthData, startYear, startMonth) {
    const filtered = {date: [], y: []};
    if ((truthData == null) || (!Array.isArray(truthData.date))) {
        return filtered;
    }

    truthData.date.forEach((dateStr, idx) => {
        if (seasonStartYear(dateStr, startMonth) === startYear) {
            filtered.date.push(dateStr);
            filtered.y.push(truthData.y[idx]);
        }
    });
    return filtered;
}


/**
 * @param date {Date} a Date object
 * @returns {String} `date` in 'YYYY-MM-DD' format. NB: not date.toISOString(), which converts to UTC and can
 *   therefore land on the wrong day
 * @private
 */
function _formatYYYYMMDDStr(date) {
    return [
        String(date.getFullYear()).padStart(4, '0'),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}


// export

export {
    closestYear, getOptionsFromURL, DEFAULT_SEASON_START_MONTH, seasonStartYear, seasonName, seasonNameForDate,
    seasonDateRange, seasonsInDates, shiftDateStrByYears, splitTruthBySeason, filterTruthToSeason
}
