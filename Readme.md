https://docs.google.com/spreadsheets/d/1lPUxGmWNQtRV2YbWsKCjog-41v0_TQAJaSO4Nlqf9AA/edit?usp=sharing

Login Codes for Teams: 
T1	74932
T2	55110
T3	76395
T4	11619
T5	19117
T6	97814
T7	16779
T8	68832
T9	13260
T10	50759
T11	66783
T12	52072
T13	10984
T14	66184
T15	11131
T16	73863
T17	12655	
T18 36830
T19	52845
T20	31796
T21	46878

Appscript code:
const SPREADSHEET_ID = '1lPUxGmWNQtRV2YbWsKCjog-41v0_TQAJaSO4Nlqf9AA';
const TRADES_SHEET_NAME = 'Trades';
const PARTICIPANTS_SHEET_NAME = 'Participants';
const STOCKS_SHEET_NAME = 'Stocks';
const NEWS_SHEET_NAME = 'News';

function doPost(e) {
  var action = e.parameter.action;
  
  if (action === 'submitTrade') {
    return submitTrade(e);
  } else if (action === 'acceptTrade') {
    return acceptTrade(e);
  } else if (action === 'rejectTrade') {
    return rejectTrade(e);
  } else {
    return ContentService.createTextOutput("Invalid action");
  }
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === "getIncomingRequests") {
    var sellerUID = e.parameter.sellerUID;
    if (!sellerUID) {
      return ContentService.createTextOutput("Missing sellerUID parameter");
    }
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var tradesSheet = ss.getSheetByName(TRADES_SHEET_NAME);
    var data = tradesSheet.getDataRange().getValues();
    var results = [];
    // Headers: TradeID, BuyerUID, BuyerName, SellerUID, Stock, Quantity, Price, Timestamp, Status
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // If the row doesn't include a Status column, assume it's "active"
      var status = (row.length >= 9 && row[8]) ? row[8] : "active";
      // Check if the row's sellerUID (column index 3) matches and status is active
      if (row[3] === sellerUID && status === "active") {
        results.push({
          tradeId: row[0],
          buyerUID: row[1],
          buyerName: row[2],
          sellerUID: row[3],
          stock: row[4],
          quantity: row[5],
          price: row[6],
          timestamp: row[7],
          status: status
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify(results))
                         .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "getPortfolio") {
    return getPortfolio(e);
  } else if (action === "getStocks") {
    return getStocks(e);
  } else if (action === "getNews") {
    return getNews(e);
  } else if (action === "getLeaderboard") {
    return getLeaderboard(e);
  } else if (action === "getTradeHistory") {  // New action added
    return getTradeHistory(e);
  } else {
    return ContentService.createTextOutput("Invalid action");
  }
}

function submitTrade(e) {
  try {
    // Retrieve parameters from the POST request
    const buyerUID = e.parameter.buyerUID;
    const buyerName = e.parameter.buyerName;
    const sellerUID = e.parameter.sellerUID;
    const stock = e.parameter.stock;
    const quantity = e.parameter.quantity;
    const price = e.parameter.price;

    if (!buyerUID || !buyerName || !sellerUID || !stock || !quantity || !price) {
      return ContentService.createTextOutput('Missing one or more required parameters');
    }

    if (buyerUID === sellerUID) {
      return ContentService.createTextOutput('Error: You cannot trade with yourself');
    }

    const tradesSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TRADES_SHEET_NAME);
    const tradeId = new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
    tradesSheet.appendRow([tradeId, buyerUID, buyerName, sellerUID, stock, quantity, price, new Date(), "active"]);

    return ContentService.createTextOutput('Success');
  } catch (error) {
    return ContentService.createTextOutput('Error: ' + error);
  }
}

function acceptTrade(e) {
  try {
    const tradeId = e.parameter.tradeId;
    if (!tradeId) return ContentService.createTextOutput("Missing tradeId");
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tradesSheet = ss.getSheetByName(TRADES_SHEET_NAME);
    const participantsSheet = ss.getSheetByName(PARTICIPANTS_SHEET_NAME);
    const data = tradesSheet.getDataRange().getValues();
    
    // Find the trade row (headers: TradeID, BuyerUID, BuyerName, SellerUID, Stock, Quantity, Price, Timestamp, Status)
    let tradeRowIndex = -1;
    let trade = {};
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == tradeId) {
        tradeRowIndex = i + 1; // Sheet rows are 1-indexed
        trade = {
          tradeId: data[i][0],
          buyerUID: data[i][1],
          buyerName: data[i][2],
          sellerUID: data[i][3],
          stock: data[i][4],
          quantity: Number(data[i][5]),
          price: Number(data[i][6]),
          status: data[i][8]
        };
        break;
      }
    }
    
    if (tradeRowIndex === -1 || trade.status !== "active") {
      return ContentService.createTextOutput("Trade not found or already processed");
    }
    
    const totalCost = trade.quantity * trade.price;
    
    // Retrieve buyer and seller records from the Participants sheet
    const buyer = getParticipant(trade.buyerUID, participantsSheet);
    const seller = getParticipant(trade.sellerUID, participantsSheet);
    
    if (!buyer || !seller) {
      return ContentService.createTextOutput("Buyer or seller not found in Participants sheet");
    }
    
    // Validate funds and holdings (assuming funds are numbers and holdings stored as JSON)
    if (buyer.funds < totalCost) {
      return ContentService.createTextOutput("Buyer has insufficient funds");
    }
    const sellerHoldings = JSON.parse(seller.holdings || '{}');
    const sellerStockQty = sellerHoldings[trade.stock] || 0;
    if (sellerStockQty < trade.quantity) {
      // Mark trade as rejected and return error message if seller doesn't have enough shares
      tradesSheet.getRange(tradeRowIndex, 9).setValue("rejected");
      return ContentService.createTextOutput("Seller does not have enough shares");
    }
    
    // Update buyer: deduct funds and add stock to holdings
    buyer.funds -= totalCost;
    let buyerHoldings = JSON.parse(buyer.holdings || '{}');
    buyerHoldings[trade.stock] = (buyerHoldings[trade.stock] || 0) + trade.quantity;
    
    // Update seller: add funds and subtract stock from holdings
    seller.funds += totalCost;
    sellerHoldings[trade.stock] = sellerStockQty - trade.quantity;
    
    // Save updates back to Participants sheet (including updated portfolio values)
    updateParticipant(trade.buyerUID, buyer.funds, JSON.stringify(buyerHoldings), participantsSheet);
    updateParticipant(trade.sellerUID, seller.funds, JSON.stringify(sellerHoldings), participantsSheet);
    
    // Mark trade as accepted in Trades sheet (this will remove it from active incoming requests)
    tradesSheet.getRange(tradeRowIndex, 9).setValue("accepted");
    
    return ContentService.createTextOutput("Trade accepted successfully");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error);
  }
}

function rejectTrade(e) {
  try {
    const tradeId = e.parameter.tradeId;
    if (!tradeId) return ContentService.createTextOutput("Missing tradeId");
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tradesSheet = ss.getSheetByName(TRADES_SHEET_NAME);
    const data = tradesSheet.getDataRange().getValues();
    
    let tradeRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == tradeId && data[i][8] === "active") {
        tradeRowIndex = i + 1;
        break;
      }
    }
    
    if (tradeRowIndex === -1) {
      return ContentService.createTextOutput("Trade not found or already processed");
    }
    
    // Mark trade as rejected in Trades sheet
    tradesSheet.getRange(tradeRowIndex, 9).setValue("rejected");
    
    return ContentService.createTextOutput("Trade rejected successfully");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error);
  }
}

// New function to get portfolio and stock prices data
function getPortfolio(e) {
  try {
    const uid = e.parameter.uid;
    if (!uid) {
      return ContentService.createTextOutput("Missing uid parameter");
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const participantsSheet = ss.getSheetByName(PARTICIPANTS_SHEET_NAME);
    const stocksSheet = ss.getSheetByName(STOCKS_SHEET_NAME);
    
    // Get participant data
    const participant = getParticipant(uid, participantsSheet);
    if (!participant) {
      return ContentService.createTextOutput("Participant not found");
    }
    
    // Get current stocks data
    const stocksData = stocksSheet.getDataRange().getValues();
    let stocks = [];
    // Assuming headers: Symbol, Price
    for (let i = 1; i < stocksData.length; i++) {
      stocks.push({
        symbol: stocksData[i][0],
        price: Number(stocksData[i][1])
      });
    }
    
    // Construct response
    const response = {
      participant: {
        uid: participant.uid,
        name: participant.name,
        funds: participant.funds,
        holdings: participant.holdings ? JSON.parse(participant.holdings) : {},
        portfolioValue: computePortfolioValue(participant.holdings)
      },
      stocks: stocks
    };
    
    return ContentService.createTextOutput(JSON.stringify(response))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error);
  }
}

// New function to get all current stock prices separately
function getStocks(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const stocksSheet = ss.getSheetByName(STOCKS_SHEET_NAME);
    const stocksData = stocksSheet.getDataRange().getValues();
    let stocks = [];
    // Assuming headers in row 1: Symbol, Price
    for (let i = 1; i < stocksData.length; i++) {
      stocks.push({
        symbol: stocksData[i][0],
        price: Number(stocksData[i][1])
      });
    }
    return ContentService.createTextOutput(JSON.stringify(stocks))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error);
  }
}

// New function to get news flash data from the News sheet
function getNews(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const newsSheet = ss.getSheetByName(NEWS_SHEET_NAME);
    const newsData = newsSheet.getDataRange().getValues();
    let newsItems = [];
    // Assuming headers in row 1: Sr, News Flash
    for (let i = 1; i < newsData.length; i++) {
      newsItems.push({
        sr: newsData[i][0],
        news: newsData[i][1]
      });
    }
    return ContentService.createTextOutput(JSON.stringify(newsItems))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error);
  }
}

// New function to get the leaderboard (participants sorted in ascending order based on portfolio value)
function getLeaderboard(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const participantsSheet = ss.getSheetByName(PARTICIPANTS_SHEET_NAME);
    const data = participantsSheet.getDataRange().getValues();
    let participants = [];
    // Assuming headers: UID, Name, Funds, Holdings, Portfolio Value
    for (let i = 1; i < data.length; i++) {
      let portfolioValue = computePortfolioValue(data[i][3]);
      participants.push({
        uid: data[i][0],
        name: data[i][1],
        funds: Number(data[i][2]),
        portfolioValue: portfolioValue
      });
    }
    // Sort in ascending order based on portfolio value
    participants.sort(function(a, b) { return b.portfolioValue - a.portfolioValue; });
    return ContentService.createTextOutput(JSON.stringify(participants))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error);
  }
}

// New function to get trade history for a given buyerUID
function getTradeHistory(e) {
  const buyerUID = e.parameter.buyerUID;
  if (!buyerUID) {
    return ContentService.createTextOutput("Missing buyerUID parameter");
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tradesSheet = ss.getSheetByName(TRADES_SHEET_NAME);
  const data = tradesSheet.getDataRange().getValues();
  let results = [];
  // Assuming headers: TradeID, BuyerUID, BuyerName, SellerUID, Stock, Quantity, Price, Timestamp, Status
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    if (row[1] == buyerUID) {  // Filter for the buyer's trades
      results.push({
        tradeId: row[0],
        buyerUID: row[1],
        buyerName: row[2],
        sellerUID: row[3],
        stock: row[4],
        quantity: row[5],
        price: row[6],
        timestamp: row[7],
        status: (row.length >= 9 && row[8]) ? row[8] : "active"
      });
    }
  }
  return ContentService.createTextOutput(JSON.stringify(results))
                       .setMimeType(ContentService.MimeType.JSON);
}

// Helper function: Get participant data from the Participants sheet
function getParticipant(uid, sheet) {
  const data = sheet.getDataRange().getValues();
  // Assuming headers: UID, Name, Funds, Holdings, Portfolio Value
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == uid) {
      return {
        uid: data[i][0],
        name: data[i][1],
        funds: Number(data[i][2]),
        holdings: data[i][3] // JSON string
      };
    }
  }
  return null;
}

// Helper function: Update participant data and compute portfolio value
function updateParticipant(uid, funds, holdings, sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == uid) {
      sheet.getRange(i + 1, 3).setValue(funds);      // Funds column (C)
      sheet.getRange(i + 1, 4).setValue(holdings);     // Holdings column (D)
      // Compute portfolio value from holdings and current stock prices
      const portfolioValue = computePortfolioValue(holdings);
      sheet.getRange(i + 1, 5).setValue(portfolioValue); // Portfolio Value column (E)
      return;
    }
  }
  return;
}

// Helper function: Get current stock price from the Stocks sheet
function getStockPrice(symbol) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stocksSheet = ss.getSheetByName(STOCKS_SHEET_NAME);
  const data = stocksSheet.getDataRange().getValues();
  // Assuming headers in row 1: Symbol, Price
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === symbol) {
      return Number(data[i][1]);
    }
  }
  return 0; // Return 0 if symbol not found
}

// Helper function: Compute total portfolio value based on holdings and current prices
function computePortfolioValue(holdingsJSON) {
  let total = 0;
  let holdings = JSON.parse(holdingsJSON || '{}');
  for (let symbol in holdings) {
    let shares = holdings[symbol];
    let price = getStockPrice(symbol);
    total += shares * price;
  }
  return total;
}
