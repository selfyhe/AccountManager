/******************************************
* AccountChecker账户检测工具
* 用于检测账户所有的交易对余额，当前挂单，历史成功订单记录，提币记录和转账记录
* 了解托管账户现状，检测是否有非API的人工操作情况。
*
* 参数如下：
* Start_Date 开始时间 YYYY-MM-DD格式 字符串型(string)	
* Currencys 币种 充提币币种，多个币种用,号分隔  字符串型(string) BTC,USDT,ETH,HT
******************************************/
var AccountIDs = {
	"spot": 0,
	"otc": 0,
	"margin":{}
}
var States = {
	"submitting":"提交中",
	"submitted":"已提交",
	"partial-filled":"部分成交",
	"partial-canceled":"部分成交撤销",
	"filled":"完全成交",
	"canceled":"已撤销"
}
var Sources = {
	"web":"网页 #FF0000",
	"spot-app":"火币APP #FF0000",
	"otc-app":"法币APP #FF0000",
	"spot-api":"API",
	"api":"API"
}

//转换数据
function changeNum(str){
	return parseFloat((parseFloat(str)+0).toFixed(8));
}

//转换交易对
function changeJYD(str){
    var ret = str;
    if(str.indexOf("usdt") != -1){
        ret = str.replace("usdt","").toUpperCase()+"/USDT";
    }else if(str.indexOf("eth") != -1){
        ret = str.replace("eth","").toUpperCase()+"/ETH";
    }else if(str.indexOf("btc") != -1){
        ret = str.replace("btc","").toUpperCase()+"/BTC";
    }else if(str.indexOf("ht") > str.length - 2){
        ret = str.replace("ht","").toUpperCase()+"/HT";
    }
    return ret;
}
//验证JSON内容格式
function isJSON(str) {
	if (typeof str == 'object'){
		return true;
	}else if (typeof str == 'string') {
        try {
            var obj=JSON.parse(str);
            if(typeof obj == 'object' && obj ){
                return true;
            }else{
                return false;
            }

        } catch(e) {
            Log("不正确的JSON格式内容！请确认参数JSON内容是否正确！");
            return false;
        }
    }
}

//返回所有账户的状态
function getAccounts(){
	var json = exchange.IO("api","GET","/v1/account/accounts","");
	if(isJSON(json) && json.status == "ok"){
		var data = json.data;
		for(var i=0;i<data.length;i++){
			var account = data[i];
			if(account.type == "spot"){
				AccountIDs.spot = account.id;
			}
			if(account.type == "otc"){
				AccountIDs.otc = account.id;
			}
			if(account.type == "margin"){
				AccountIDs.margin[account.subtype] = account.id;
			}
		}
	}
}

//获取当前所有币种行情
function getTickers(){
	var tickers = [];
	var json = exchange.IO("api","GET","/market/tickers","");
	if(isJSON(json) && json.status == "ok"){
		var list = json.data;
		for(var i=0;i<list.length;i++){
			tickers.push(list[i]);
		}
	}
	return tickers;
}

function getSymbolLast(tickers, symbol){
	var last = 0;
	if(symbol == 'usdtusdt'){
		last = 1;
	}else if(symbol == 'btcbtc'){
		last = 1;
	}else if(symbol == 'usdtbtc'){
		last = (1/parseFloat(getSymbolLast(tickers, "btcusdt"))).toFixed(8);
	}else{
		for(var i=0;i<tickers.length;i++){
			if(tickers[i].symbol == symbol){
				last = tickers[i].close;
			}
		}
	}
	return last;
}

//查询交易账户余额
function getAccountSpot(){
	var balances = [];
	var tickers = getTickers();
	var json = exchange.IO("api","GET","/v1/account/accounts/"+AccountIDs.spot+"/balance","");
	if(isJSON(json) && json.status == "ok"){
		var list = json.data.list;
		var usdtallvalue = 0;
		var btcallvalue = 0;
		for(var i=0;i<list.length;i+=2){
			//['币种','可用','冻结','USDT价格','USDT价值','BTC价格','BTC价值']
			var trade = list[i];
			var frozen = list[i+1];
			if(trade.currency == frozen.currency && (trade.balance != "0" || frozen.balance != "0")){
                var t = changeNum(trade.balance);
                var f = changeNum(frozen.balance);
                if(t > 0 || f > 0){
					var usdtprice = getSymbolLast(tickers, trade.currency+"usdt");
					var btcprice = getSymbolLast(tickers, trade.currency+"btc");
					var stocks = parseFloat(trade.balance)+parseFloat(frozen.balance);
					var usdtvalue = stocks*parseFloat(usdtprice);
					var btcvalue = stocks*parseFloat(btcprice);
					usdtallvalue += usdtvalue;
					btcallvalue += btcvalue;
				    var item = [trade.currency.toUpperCase(),t,f,usdtprice,changeNum(usdtvalue),btcprice,changeNum(btcvalue)];
				    balances.push(item);
                }
			}
		}
		balances.push(['合计',0,0,0,changeNum(usdtallvalue),0,changeNum(btcallvalue)]);
	}
	return balances;
}

//查询杠杆区账户余额
function getAccountMargin(){
	var balances = [];
    if(!AccountIDs.margin) return balances;
	for(var symbol in AccountIDs.margin){
		var json = exchange.IO("api","GET","/v1/account/accounts/"+AccountIDs.margin[symbol]+"/balance","");
		if(isJSON(json) && json.status == "ok"){
			var list = json.data.list;
			var item = [];
			if(symbol.indexOf(list[0].currency) == 0){
				item = [symbol,list[0].currency.toUpperCase(),changeNum(list[0].balance),changeNum(list[1].balance),changeNum(list[2].balance),changeNum(list[3].balance),list[4].currency.toUpperCase(),changeNum(list[4].balance),changeNum(list[5].balance),changeNum(list[6].balance),changeNum(list[7].balance)];
			}else{
				item = [symbol,list[4].currency.toUpperCase(),changeNum(list[4].balance),changeNum(list[5].balance),changeNum(list[6].balance),changeNum(list[7].balance),list[0].currency.toUpperCase(),changeNum(list[0].balance),changeNum(list[1].balance),changeNum(list[2].balance),changeNum(list[3].balance)];
			}
			balances.push(item);
		}
	}
	return balances;
}

//查询法币账户余额
function getAccountOtc(){
	var balances = [];
    if(!AccountIDs.otc) return balances;
	var json = exchange.IO("api","GET","/v1/account/accounts/"+AccountIDs.otc+"/balance","");
	if(isJSON(json) && json.status == "ok"){
		var list = json.data.list;
		for(var i=0;i<list.length;i+=2){
			var trade = list[i];
			var frozen = list[i+1];
			if(trade.currency == frozen.currency){
				var item = [trade.currency.toUpperCase(),changeNum(trade.balance),changeNum(frozen.balance)];
				balances.push(item);
			}
		}
	}
	return balances;
}

function getOpenningOrders(){
	var orders = [];
	var json = exchange.IO("api","GET","/v1/order/openOrders","size=0");
	if(isJSON(json) && json.status == "ok"){
		var data = json.data;
		for(var i=0;i<data.length;i++){
			//['挂单时间','编号','交易对','操作类型','交易类型','数量','价格','完成量','交易金额','状态','操作来源'];
			var o = data[i];
			var item = [_D(o['created-at']),o.id,changeJYD(o.symbol),(o.type.indexOf('sell')==0?'卖出':'买入'),(o.type.indexOf('limit')>0?'限价':'市价'),o.amount,o.price,o["filled-amount"],o["filled-cash-amount"],States[o.state],Sources[o.source]];
			orders.push(item);
		}
	}
	return orders
}

function getFinishedOrders(){
	var orders = [];
	var json = exchange.IO("api","GET","/v1/order/matchresults","start-date="+Start_Date);
	if(isJSON(json) && json.status == "ok"){
		var data = json.data;
		for(var i=0;i<data.length;i++){
			//['成交时间','编号','交易对','操作类型','交易类型','成交数量','成交均价','操作来源'];
			var o = data[i];
			var item = [_D(o['created-at']),o.id,changeJYD(o.symbol),(o.type.indexOf('sell')==0?'卖出':'买入'),(o.type.indexOf('limit')>0?'限价':'市价'),o["filled-amount"],o.price,Sources[o.source]];
			orders.push(item);
		}
	}
	return orders
}

var DepositStates = {
	"unknown":"状态未知",
    "confirming":"确认中",
    "confirmed":"已经确认",
    "safe":"已完成",
    "orphan":"待确认"
};


function getDepositStocks(currencystr){
	var orders = [];
	var cs = currencystr.split(",");
	for(var c=0;c<cs.length;c++){
		var json = exchange.IO("api","GET","/v1/query/deposit-withdraw","currency="+cs[c].toLowerCase()+"&type=deposit&from=0&size=100");
		if(isJSON(json) && json.status == "ok"){
			var data = json.data;
			for(var i=0;i<data.length;i++){
				//['发起时间','编号','币种','交易哈希','个数','地址','地址标签','状态'];
				var o = data[i];
				var item = [_D(o['created-at']),o.id,o.currency.toUpperCase(),o["tx-hash"],o.amount,o.address,o["address-tag"],DepositStates[o.state]];
				orders.push(item);
			}		
		}
		Sleep(500);
	}
	return orders
}

var WithdrawStates = {
	"submitted":"已提交",
	"reexamine":"审核中",
	"canceled":"已撤销",
	"pass":"审批通过",
	"reject":"审批拒绝",
	"pre-transfer":"处理中",
	"wallet-transfer":"已汇出",
    "wallet-reject":"钱包拒绝",
    "confirmed":"区块已确认",
    "confirm-error":"区块确认错误",
	"repealed":"已撤销"
};


function getWithdrawStocks(currencystr){
	var orders = [];
	var cs = currencystr.split(",");
	for(var c=0;c<cs.length;c++){
		var json = exchange.IO("api","GET","/v1/query/deposit-withdraw","currency="+cs[c].toLowerCase()+"&type=withdraw&from=0&size=100");
		if(isJSON(json) && json.status == "ok"){
			var data = json.data;
			for(var i=0;i<data.length;i++){
				//['发起时间','编号','币种','交易哈希','个数','地址','地址标签','状态'];
				var o = data[i];
				var item = [_D(o['created-at']),o.id,o.currency.toUpperCase(),o["tx-hash"],o.amount,o.address,o["address-tag"],WithdrawStates[o.state]];
				orders.push(item);
			}		
		}
		Sleep(500);
	}
	return orders
}


//处理状态的显示
function showStatus(){
	//账户余额信息表
	var AccountTables = [];
	var accounttable1 = {};
	accounttable1.type="table";
	accounttable1.title = "交易区账户资产";
	accounttable1.cols = ['币种','可用','冻结','USDT价格','USDT价值','BTC价格','BTC价值'];
	accounttable1.rows = getAccountSpot();
	AccountTables.push(accounttable1);
	var accounttable2 = {};
	accounttable2.type="table";
	accounttable2.title = "杠杆区账户资产";
	accounttable2.cols = ['交易对','币种','可用','冻结','借贷','利息','币种','可用','冻结','借贷','利息'];
	accounttable2.rows = getAccountMargin();
	AccountTables.push(accounttable2);
	var accounttable3 = {};
	accounttable3.type="table";
	accounttable3.title = "法币交易区账户资产";
	accounttable3.cols = ['币种','可用','冻结'];
	accounttable3.rows = getAccountOtc();;
	AccountTables.push(accounttable3);
	//交易记录信息表
	var OrderTables = [];
	var ordertable1 = {};
	ordertable1.type="table";
	ordertable1.title = "当前挂单";
	ordertable1.cols = ['挂单时间','编号','交易对','操作类型','交易类型','数量','价格','完成量','交易金额','状态','操作来源'];
	ordertable1.rows = getOpenningOrders();
	OrderTables.push(ordertable1);
	var ordertable2= {};
	ordertable2.type="table";
	ordertable2.title = "历史成交订单";
	ordertable2.cols = ['成交时间','编号','交易对','操作类型','交易类型','成交数量','成交均价','操作来源'];
	ordertable2.rows = getFinishedOrders();
	OrderTables.push(ordertable2);
	var ordertable3 = {};
	ordertable3.type="table";
	ordertable3.title = "充币记录";
	ordertable3.cols = ['发起时间','编号','币种','交易哈希','个数','地址','地址标签','状态'];
	ordertable3.rows = getDepositStocks(Currencys);
	OrderTables.push(ordertable3);
	var ordertable4 = {};
	ordertable4.type="table";
	ordertable4.title = "提币记录";
	ordertable4.cols = ['发起时间','编号','币种','交易哈希','个数','地址','地址标签','状态'];
	ordertable4.rows = getWithdrawStocks(Currencys);
	OrderTables.push(ordertable4);
	LogStatus("`" + JSON.stringify(AccountTables)+"`\n`" + JSON.stringify(OrderTables)+"`\n以下订单记录始于："+Start_Date);	
}

//初始化运行参数
function init(){
	//重置日志
    LogReset();
}

function main() {
	Log("开始执行主事务程序..."); 
	getAccounts();
	Log(AccountIDs);
	showStatus();
}