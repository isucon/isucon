var MY_TEAM = null;

$(function(){
  var TEAMS = $.map($('td.team'), function(t){return $(t).attr('id');});
  var update_all_team = function(fastMode){
    var teams = TEAMS.concat();
    function update_one_team(){
      var teamid = teams.splice(Math.floor(Math.random() * teams.length), 1);
      update_team_status(teamid);
      if (teams.length > 0)
        setTimeout(update_one_team, (fastMode ? 10: 10000));
      else
        setTimeout(update_all_team, 20000);
    };
    update_one_team();
  };
  setTimeout(function(){update_all_team(true);}, 1000);
  setInterval(function(){if (MY_TEAM){ update_team_status(MY_TEAM); }}, 5000);
  setInterval(encolor_highest_score, 30000);

  $('#bunner').click(function(event){
    if (MY_TEAM) {
      MY_TEAM = null;
      alert('release busy update team');
    }
  });
  $('td.name').click(function(event){
    MY_TEAM = $(event.target).closest('td.team').attr('id');
    alert('set ' + MY_TEAM + ' to update frequently');
  });
  $('td.latest').click(function(event){
    show_latest_result_detail($(event.target).closest('td.team').attr('id'));
  });
  $('td.highest').click(function(event){
    show_highest_result_detail($(event.target).closest('td.team').attr('id'));
  });
  $('td.bench').click(function(event){
    show_start_bench_dialog($(event.target).closest('td.team').attr('id'));
  });
});

function encolor_highest_score(){
  $('td.highscore').removeClass('highscore');
  var highest = 0;
  var team = null;
  $.each($('td.latest'), function(i,e){
    var s = Number($(e).text().split(':')[1]);
    if (s > highest) {
      highest = s;
      team = e;
    };
  });
  if (team)
    $(team).closest('td.team').addClass('highscore');
};

function update_team_status(teamid){
  if (! (/^team\d+$/.exec(teamid)))
    return;
  /*
      test:(latest.test == 1),
      latest:latest,
      highest:highest,
      running:running
   */
  var targetBox = $('td.team#' + teamid + ' table.box');
  var teamName = targetBox.find('td.name');
  var latest = targetBox.find('td.latest');
  var latestAt = targetBox.find('td.latest_at');
  var highest = targetBox.find('td.highest');
  var highestAt = targetBox.find('td.highest_at');
  var bench = targetBox.find('td.bench');
  var formatTime = function(resulttime){
    var time = resulttime.substring(8);
    return time.substring(0,2) + ':' + time.substring(2,4) + ':' + time.substring(4);
  };
  $.get('/status/' + teamid, function(data){
    if (data.test && teamName.hasClass('failing'))
      teamName.removeClass('failing');
    else if ((! data.test) && (! teamName.hasClass('failing')))
      teamName.addClass('failing');

    if (data.latest === null) {
      latest.text('no tests ran');
      latestAt.text('at ...');
    }
    else if (data.latest.test) {
      latest.text('LATEST:' + data.latest.score);
      latestAt.text('at ' + formatTime(data.latest.resulttime));
    }
    else {
      latest.text('LATEST TEST FAILED');
      latestAt.text('at ' + formatTime(data.latest.resulttime));
    }

    if (data.highest !== null) {
      highest.text('BEST:' + data.highest.score);
      highestAt.text('at ' + formatTime(data.highest.resulttime));
    }
    else {
      highest.text('no tests successed');
      highestAt.text('at ...');
    }
    
    if (data.running && (! bench.hasClass('running'))) {
      bench.text('running');
      bench.addClass('running');
      bench.unbind().click(function(event){
        show_stop_bench_dialog($(event.target).closest('td.team').attr('id'));
      });
    }
    else if ((! data.running) && bench.hasClass('running')) {
      bench.text('idle');
      bench.removeClass('running');
      bench.unbind().click(function(event){
        show_start_bench_dialog($(event.target).closest('td.team').attr('id'));
      });
    }
  });
};

function show_latest_result_detail(teamid){
  if (! (/^team\d+$/.exec(teamid)))
    return;
  $.get('/latest/' + teamid, function(data){
    var dialogbox = $('#result_display_dialog');
    dialogbox.dialog({
      autoOpen: false,
      hight: 500,
      width: 800,
      modal: true,
      buttons: {'OK': function(){dialogbox.dialog('close');}}
    });
    $('div#benchkind').text('latest benchmark');
    $('pre#benchdetail').text(data.bench);
    $('div#checkerkind').text('checker');
    $('pre#checkerdetail').text(data.checker);
    dialogbox.dialog('open');
  });
};

function show_highest_result_detail(teamid){
  if (! (/^team\d+$/.exec(teamid)))
    return;
  $.get('/highest/' + teamid, function(data){
    var dialogbox = $('#result_display_dialog');
    dialogbox.dialog({
      autoOpen: false,
      hight: 500,
      width: 800,
      modal: true,
      buttons: {'OK': function(){dialogbox.dialog('close');}}
    });
    $('div#benchkind').text('best benchmark');
    $('pre#benchdetail').text(data.bench);
    $('div#checkerkind').text('checker');
    $('pre#checkerdetail').text(data.checker);
    dialogbox.dialog('open');
  });
};

function show_start_bench_dialog(teamid){
  if (! (/^team\d+$/.exec(teamid)))
    return;
  var dialogbox = $('#bench_start_dialog');
  dialogbox.dialog({
    autoOpen: false,
    height: 250,
    width: 600,
    modal: true,
    buttons: {
      'START': function(){
        exec_start_bench(
          teamid,
          $('#bench_start_dialog form#benchstart ul li input[name="pass"]').val(),
          ($('#bench_start_dialog form#benchstart ul li input[name="infmode"]').attr('checked') ? 'on' : ''),
          function(){
            dialogbox.dialog('close');
            setTimeout(function(){update_team_status(teamid);}, 2000);
          }
        );
      },
      'CANCEL': function(){dialogbox.dialog('close');}
    }
  });
  $('li#benchstart_team').text('start ' + teamid + ' benchmark');
  dialogbox.dialog('open');
};

function show_stop_bench_dialog(teamid){
  if (! (/^team\d+$/.exec(teamid)))
    return;
  var dialogbox = $('#bench_stop_dialog');
  dialogbox.dialog({
    autoOpen: false,
    height: 250,
    width: 600,
    modal: true,
    buttons: {
      'STOP': function(){
        exec_stop_bench(
          teamid,
          $('#bench_stop_dialog form#benchstop ul li input[name="pass"]').val(),
          $('#bench_stop_dialog form#benchstop ul li input[name="gracefully"]').val(),
          function(){
            dialogbox.dialog('close');
            setTimeout(function(){update_team_status(teamid);}, 2000);
          }
        );
      },
      'CANCEL': function(){dialogbox.dialog('close');}
    }
  });
  $('li#benchstop_team').text('stop ' + teamid + ' benchmark');
  dialogbox.dialog('open');
};

function exec_start_bench(teamid, pass, infmode, callback){
  $.ajax({
    url: '/bench/start/' + teamid,
    type: 'POST',
    data: {pass:pass,infmode:infmode},
    success: function(data, textStatus, jqXHR){
      callback();
    },
    error: function(jqXHR, textStatus, errorThrown){
      alert(jqXHR.responseText);
      callback();
    }
  });
};

function exec_stop_bench(teamid, pass, gracefully, callback){
  $.ajax({
    url: '/bench/stop/' + teamid,
    type: 'POST',
    data: {pass:pass,gracefully:gracefully},
    success: function(data, textStatus, jqXHR){
      callback();
    },
    error: function(jqXHR, textStatus, errorThrown){
      alert(jqXHR.responseText);
      callback();
    }
  });
};