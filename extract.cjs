const fs = require("fs");
const code = fs.readFileSync("figma_component.js", "utf8");

function extractBalanced(str, startChar, endChar, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escape = false;
  for (let i = startIndex; i < str.length; i++) {
    const c = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (inString) {
      if (c === stringChar) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inString = true;
      stringChar = c;
      continue;
    }
    if (c === startChar) {
      depth++;
    } else if (c === endChar) {
      depth--;
      if (depth === 0) {
        return str.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

const vars = {};

function getVar(name, pattern, startChar, endChar) {
  const match = code.match(pattern);
  if (match) {
    const startIdx = match.index + match[0].length - 1;
    const extracted = extractBalanced(code, startChar, endChar, startIdx);
    if (extracted) {
      vars[name] = extracted;
      console.log(name, "extracted, length:", extracted.length);
    } else {
      console.log(name, "balanced match failed");
    }
  } else {
    console.log(name, "pattern not found");
  }
}

getVar("welcomeTrans", /Hhe\s*=\s*\{/, "{", "}");
getVar("onboardingTrans", /The\s*=\s*\{/, "{", "}");
getVar("farmerDashTrans", /Nhe\s*=\s*\{/, "{", "}");
getVar("buyerMarketTrans", /Bhe\s*=\s*\{/, "{", "}");
getVar("addProduceTrans", /Yhe\s*=\s*\{/, "{", "}");
getVar("listingDetailTrans", /Jhe\s*=\s*\{/, "{", "}");
getVar("chatTrans", /rpe\s*=\s*\{/, "{", "}");
getVar("paymentTrans", /ipe\s*=\s*\{/, "{", "}");
getVar("deliveryTrans", /spe\s*=\s*\{/, "{", "}");
getVar("cropsTrans", /ope\s*=\s*\{/, "{", "}");
getVar("namesTrans", /npe\s*=\s*\{/, "{", "}");
getVar("villagesTrans", /cpe\s*=\s*\{/, "{", "}");

const usersIdx = code.indexOf('rs=[{id:"farmer1"');
if (usersIdx !== -1) {
  const usersStart = usersIdx + 3;
  const extracted = extractBalanced(code, "[", "]", usersStart);
  vars["mockUsers"] = extracted;
  console.log("mockUsers extracted, length:", extracted ? extracted.length : 0);
}

const produceIdx = code.indexOf('let[f,g]=q([{id:"1"');
if (produceIdx !== -1) {
  const produceStart = code.indexOf("[{id:\"1\"", produceIdx);
  const extracted = extractBalanced(code, "[", "]", produceStart);
  vars["mockProduce"] = extracted;
  console.log("mockProduce extracted, length:", extracted ? extracted.length : 0);
}

getVar("govtPrices", /vl\s*=\s*\[/, "[", "]");

// Also extract ll function
const llMatch = code.match(/ll\s*=\s*\((?:e,t,r,i,s,o)\)\s*=>\s*\{/);
if (llMatch) {
  const llStart = llMatch.index + llMatch[0].length - 1;
  const llBody = extractBalanced(code, "{", "}", llStart);
  vars["llFunction"] = "function generateChatReply(e,t,r,i,s,o) " + llBody;
  console.log("llFunction extracted, length:", llBody.length);
}

fs.writeFileSync("extracted_data.json", JSON.stringify(vars, null, 2));
console.log("Saved to extracted_data.json");
