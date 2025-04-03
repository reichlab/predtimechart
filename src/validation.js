import validate from './schema-validator.cjs'; // Ajs standalone validation code


//
// utilities
//

// per https://stackoverflow.com/questions/31128855/comparing-ecma6-sets-for-equality
const eqSet = (xs, ys) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x));


//
// _validateOptions()
//

/**
 * Validates an initialize() options object.
 *
 * @param {Object} options - visualization initialization options as documented at https://docs.zoltardata.com/visualizationoptionspage/
 * @throws {Error} - if invalid
 * @private
 */
function _validateOptions(options) {
    // options object: must be present
    if ((options === null) || (typeof options !== "object")) {
        throw `options object is required but missing`;
    }

    // validate structure based on JSON Schema using Ajv-compiled validation function
    const valid = validate(options);
    if (!valid) {
        console.error(`_validateOptions(): invalid schema. ${validate.errors.length} error(s). options:, errors:`,
            (JSON.stringify(options, null, '    ')), validate.errors);
        // use a long, somewhat unreadable error string so that users (and tests) can get a clue to the problem
        const errorStr = validate.errors.map(errorObj => JSON.stringify(errorObj)).join(', ');
        throw `invalid options structure: ${errorStr}`;
    }

    // validate non-schema (i.e., semantic) constraints.
    // case: available_as_ofs keys in target_variables value
    const availableAsOfs = options['available_as_ofs'];
    const targetVariables = options['target_variables'];
    Object.keys(availableAsOfs).forEach(availableAsOfKey => {
        let keyWasPresent = false;
        targetVariables.forEach(targetVariable => {
            if (targetVariable.value === availableAsOfKey) {
                keyWasPresent = true;
            }
        });
        if (!keyWasPresent) {
            throw `available_as_ofs key not in target_variables value. key=${availableAsOfKey}`;
        }
    });

    // case: task_ids keys in target_variables value
    const taskIds = options['task_ids'];
    Object.keys(taskIds).forEach(taskIDsKey => {
        let keyWasPresent = false;
        targetVariables.forEach(targetVariable => {
            if (targetVariable.value === taskIDsKey) {
                keyWasPresent = true;
            }
        });
        if (!keyWasPresent) {
            throw `task_ids key not in target_variables value. key=${taskIDsKey}`;
        }
    });

    // case: initial_checked_models in models
    const models = options['models'];
    options['initial_checked_models'].forEach(model => {
        if (!models.includes(model)) {
            throw `initial_checked_models model not in models: ${model}`;
        }
    });

    // case: initial_interval in intervals
    const initialInterval = options['initial_interval'];
    if (!options['intervals'].includes(initialInterval)) {
        throw `initial_interval not in intervals: ${initialInterval}`;
    }

    // case: initial_target_var in target_variables values
    const targetVarValues = targetVariables.map((targetVariable) => targetVariable['value']);
    const initialTargetVar = options['initial_target_var'];
    if (!targetVarValues.includes(initialTargetVar)) {
        throw `initial_target_var not in target_variables: ${initialTargetVar}`;
    }

    // case: initial_as_of in available_as_ofs array. NB: this test must come after
    // "initial_target_var in target_variables values" test b/c here we depend on initial_target_var being valid
    const initialAsOf = options['initial_as_of'];
    const initialTargetVarAvailAsOfs = availableAsOfs[initialTargetVar];
    if (!initialTargetVarAvailAsOfs.includes(initialAsOf)) {
        throw `initial_as_of not in available_as_ofs: ${initialAsOf}`;
    }

    // case: initial_task_ids key in task_ids
    const initialTaskIds = options['initial_task_ids'];
    if (!eqSet(new Set(Object.keys(taskIds[initialTargetVar])), new Set(Object.keys(initialTaskIds)))) {
        throw `initial_task_ids key !== task_ids: ${JSON.stringify(initialTaskIds)}`;
    }

    // case: initial_task_ids value in task_ids
    Object.keys(initialTaskIds).forEach(initialTaskIdKey => {
        const initialTaskIdValue = initialTaskIds[initialTaskIdKey];
        const taskIdValues = taskIds[initialTargetVar][initialTaskIdKey].map((taskIdObj) => taskIdObj['value']);
        if (!taskIdValues.includes(initialTaskIdValue)) {
            throw `initial_task_ids value not in task_ids. initialTaskIdValue=${initialTaskIdValue}, taskIdValues=${taskIdValues}`;
        }
    });
}

export default _validateOptions;
