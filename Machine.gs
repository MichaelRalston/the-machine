var playerColumn = 9;
var resetColumn = 8;

function getInputSheet() {
  return SpreadsheetApp.getActiveSheet();
}

function getOutputSheet() {
  return SpreadsheetApp.getActiveSheet();
}

function parseCell(votes) { // turns a comma-separated list of votes into a list of votes.
  var separatedVotes = (''+votes).split(",");
  return separatedVotes.map(function(v) { return v.trim(); });
}

function readVotes() { // IO [Voter][Votee][Int]
  var sheet = getInputSheet();
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; data[i] && data[i][playerColumn]; i++) {
    result.push([]);
    for (var j = playerColumn+1; j < data[i].length; j++) {
      if (data[i][j]) {
        var parsedCell = parseCell(data[i][j]);
        result[i-1].push(parsedCell);
      } else {
        result[i-1].push([]);
      }
    }
  }
  return result;
}

function buildVoteList(votes) { // [Voter][Votee][Int] -> [(Voter, Votee, Int)]
  var voteList = [];
  for (var i = 0; i < votes.length; i++) {
    for (var j = 0; j < votes[i].length; j++) {
      for (var k = 0; k < votes[i][j].length; k++) {
        voteList.push([votes[i][j][k], [i, j, votes[i][j][k]]]);
      }
    }
  }
  voteList.sort(function(first, second) { return first[0] - second[0]; });
  return voteList.map(function (elem) { return elem[1]; });
}

function removePlayerFromVotal(votal, voter) { // Votal -> Name -> Votal
  var newVotal = {};
  for (votee in votal) {
    if (votee != 'absent') {
      var newVoterList = votal[votee].filter(function(nameAndVotes) { return nameAndVotes[0] != voter; });
      if (newVoterList && newVoterList.length > 0) {
        newVotal[votee] = newVoterList;
        //JSON.parse(JSON.stringify(newVoterList));
      }
    } else {
      newVotal[votee] = votal[votee].filter(function(name) { return name != voter; });
    }
  }
  return newVotal;
}

function buildVotals(players, voteList, resetList) { // [Name] -> [(Voter, Votee, Int)] -> [Int, [Name]] -> [(Voter, Votee, Int, Votal)]
  var livelist = players;
  var votal = {absent: livelist.slice()};
  var j = 0;
  var result = [];
  for (var i = 0; i < voteList.length; i++) {
    while (j < resetList.length && resetList[j][0]-voteList[i][2] <= 0) {
      livelist = livelist.filter(function(name) { return resetList[j][1].indexOf(name) < 0; });
      ++j;
      votal = {absent: livelist.slice()};
    }
    var voter = players[voteList[i][0]];
    var votee = players[voteList[i][1]];
    var voteNum = voteList[i][2];
    votal = removePlayerFromVotal(votal, voter);
    if (!votal[votee]) {
      votal[votee] = [];
    }
    votal[votee].push([voter, voteNum]);
    result.push([voter, votee, voteNum, votal]);
  }
  return result;
}

function stringifyVotes(votee, votes) {
  result = votee + " (" + votes.length + "): ";
  for (var i = 0; i < votes.length; i++) {
    if (i > 0) {
      result += ", ";
    }
    result += votes[i][0] + " (#" + votes[i][1] + ")";
  }
  result += "\n";
  return result;
}

function stringifyVotal(votal) {
  var voteResult = [];
  for (votee in votal) {
    if (votee != 'absent') {
      if (votee && votee != 'undefined') {
        voteResult.push([votee, votal[votee]]);
      } else {
        votal['absent'] = votal['absent'].concat(votal[votee].map(function(nameAndOther) { return nameAndOther[0]; }));
      }
    }
  }
  voteResult.sort(function(left, right) {
    return left[1].length - right[1].length;
  });
  var result = '';
  for (var i = 0; i < voteResult.length; i++) {
    result += stringifyVotes(voteResult[i][0], voteResult[i][1]);
  }
  result += "\n";
  result += "Abstaining (" + votal['absent'].length + "): ";
  for (var i=0; i<votal['absent'].length; i++) {
    if (i > 0) {
      result += ", ";
    }
    result += votal['absent'][i];
  }
  result += "\n";
  return result;
}

function writeVoteList(players, votalList) { // [Name] -> [(Voter, Votee, Int, Votal)] -> IO ()
  var sheet = getOutputSheet();
  for (var i = 0; i < votalList.length; i++) {
    sheet.getRange(i+2, 2).setValue(votalList[i][0]);
    sheet.getRange(i+2, 3).setValue(votalList[i][1]);
    sheet.getRange(i+2, 1).setValue(votalList[i][2]);
    sheet.getRange(i+2, 5).setNote(stringifyVotal(votalList[i][3]));
  }
}

function readPlayers() { // IO [Name]
  var sheet = getInputSheet();
  var data = sheet.getDataRange().getValues();
  var players = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][playerColumn]) {
      players.push(data[i][playerColumn]);
    }
  }
  return players;
}

function makeResetList() { // IO [Int, [Name]]
  var resetList = [];
  var sheet = getInputSheet();
  var data = sheet.getDataRange().getValues();
  var elems = [];
  for (var i=0;data[i][resetColumn];i++) {
    elems.push(data[i][resetColumn]);
  }
  for (var i=0;i < elems.length; i++) {
    var elem = elems[i].trim().split(" ").map(function(v) { return v.trim(); });
    vote = elem.shift();
    resetList.push([vote, elem]);
  }
  return resetList;
}

function runUpdate() {
  var votes = readVotes();
  var players = readPlayers();
  var voteList = buildVoteList(votes);
  var resetList = makeResetList();
  var votalList = buildVotals(players, voteList, resetList);
  writeVoteList(players, votalList);
}

function onEdit() {
  runUpdate();
}

function buildSheet() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Setting up The Machine",
    "Please enter the names, separated by spaces",
    ui.ButtonSet.OK);

  var outputSheet = getOutputSheet();
  outputSheet.clear();
  outputSheet.clearNotes();
  var inputSheet = getInputSheet();
  inputSheet.clear();
  inputSheet.clearNotes();

  outputSheet.getRange(1, 1).setValue("Post #");
  outputSheet.getRange(1, 2).setValue("Voter");
  outputSheet.getRange(1, 3).setValue("Votee");
  outputSheet.getRange(1, 5).setValue("Votal");
  
  // outputSheet.getRange(1, 7).setValue("Resets");
  // outputSheet.getRange(1, 8).setValue("Removed Players");
  
  inputSheet.getRange(1, resetColumn).setValue("Resets: ");
  inputSheet.getRange(1, resetColumn).setNote("Resets are a post number, followed by a space, followed by any number (including none) of player names to remove from the vote list.");
  inputSheet.getRange(1, playerColumn+1).setValue("Votee ->");
  inputSheet.getRange(1, playerColumn+1).setNote("Record votes as a comma-separated list of post numbers, where the voter is the row and the votee is the column.");
  
  var names = response.getResponseText().split(' ').filter(function(e) { return e.trim() != ''; }).map(function(v) { return v.trim(); });
  for (var i=0;i<names.length;i++) {
    inputSheet.getRange(i+2, playerColumn+1).setValue(names[i]);
    inputSheet.getRange(1, playerColumn+1+1+i).setValue(names[i]);
  }
  inputSheet.getRange(1, playerColumn+1+1+names.length).setValue("Unvote");
}

function onInstall(e) {
  onOpen(e);
}

function onOpen() {
  SpreadsheetApp.getUi().createAddonMenu().addItem('Run Machine Setup', 'buildSheet').addToUi();
  var outputSheet = getOutputSheet();
  if (outputSheet.getRange(1, 1).getValue() != "Post #") {
    buildSheet();
  }
}
