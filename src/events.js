/**
 * UI helper function
 */
function addEventHandlers(app, userEnsembleModel) {
    // option, task ID, and interval selects
    $('#target_variable').change(function () {
        app.targetVariableSelected(app, this.value);
    });
    Object.keys(app.state.task_ids).forEach(function (taskIdKey) {
        const $taskIdSelect = $(`#${taskIdKey}`);  // created by `createDomElements()`
        $taskIdSelect.change(function () {
            app.taskIdsSelected(app, _selectedTaskIDs(app));
        });
    });
    $('#intervals').change(function () {
        app.intervalSelected(app, this.value);
    });

    // truth checkboxes
    $("#forecastViz_Current_Truth").change(function () {
        _setSelectedTruths(app);  // 'truthsSelected'
    });
    $("#forecastViz_Truth_as_of").change(function () {
        _setSelectedTruths(app);  // 'truthsSelected'
    });

    // Shuffle Colours button
    $("#forecastViz_shuffle").click(function () {
        app.shuffleColors(app);
    });

    // User Ensemble Model Actions dropdown button. NB: these will not be created by initialize() if !isUemEnabled,
    // but JQuery will not error if they don't exist :-)
    $("#addUserEnsemble").click(function (event) {
        event.preventDefault();
        app.addUserEnsemble(app);
    });
    $("#removeUserEnsemble").click(function (event) {
        event.preventDefault();
        app.removeUserEnsemble(app);
    });
    $("#downloadUserEnsemble").click(function (event) {
        event.preventDefault();
        app.downloadUserEnsemble(app, userEnsembleModel);
    });
    $("#infoUserEnsemble").click(function (event) {
        event.preventDefault();
        app.infoUserEnsemble(app, userEnsembleModel);
    });

    // handle #uemEditModelNameModal activity:
    $('#uemEditModelName').on('input', function () {
        app.uemEditModelNameInput(app);
    });
    $("#uemEditSaveButton").click(function () {
        const newModelName = $("#uemEditModelName").val();
        app.uemEditSaveModelName(app, userEnsembleModel, newModelName);
    });
    $("#editNameUserEnsemble").click(function (event) {
        event.preventDefault();

        // configure and show the user model name edit modal
        const modelName = userEnsembleModel.name;
        $("#uemEditModelName").val(modelName);  // initialize name to current
        $('#uemEditModelNameModal').modal('show');
    });

    // "Select Models" checkbox
    $("#forecastViz_all").change(function () {
        const $this = $(this);
        const isChecked = $this.prop('checked');
        app.toggleModels(app, isChecked);
    });

    // wire up model checkboxes
    addModelCheckEventHandler(app);  // 'modelChecked'

    // left and right buttons
    $("#decrement_as_of").click(function () {
        app.decrementAsOf(app);
    });
    $("#increment_as_of").click(function () {
        app.incrementAsOf(app);
    });

    // left and right keys
    window.addEventListener('keydown', function (event) {
        if (event.code === "ArrowLeft") {
            app.decrementAsOf(app);
        } else if (event.code === "ArrowRight") {
            app.incrementAsOf(app);
        }
    });
}


// returns the value(s) of the task ID <SELECT>(s) as an object similar to format of initial_task_ids, e.g.,
// {"scenario_id": 1, "location": "48"}
function _selectedTaskIDs(app) {
    const selectedTaskIDs = {};  // return value. filled next
    Object.keys(app.state.task_ids).forEach(function (taskIdKey) {
        const $taskIdSelect = $(`#${taskIdKey}`);  // created by `createDomElements()`
        selectedTaskIDs[taskIdKey] = $taskIdSelect.val();
    });
    return selectedTaskIDs;
}


function _setSelectedTruths(app) {
    const isCurrTruthChecked = $("#forecastViz_Current_Truth").prop('checked');
    const isAsOfTruthChecked = $("#forecastViz_Truth_as_of").prop('checked');  // ""
    const selectedTruths = [];
    if (isCurrTruthChecked) {
        selectedTruths.push('Current Truth');
    }
    if (isAsOfTruthChecked) {
        selectedTruths.push('Truth as of');
    }
    app.truthsSelected(app, selectedTruths);
}


function addModelCheckEventHandler(app) {
    $(".model-check").change(function () {
        const $this = $(this);
        const model = $this.prop('id');
        const isChecked = $this.prop('checked');
        app.modelChecked(app, model, isChecked);
    });
}


// export

export {addEventHandlers, addModelCheckEventHandler}