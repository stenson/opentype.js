// The `name` naming table.
// https://www.microsoft.com/typography/OTSPEC/name.htm

'use strict';

var encode = require('../types').encode;
var parse = require('../parse');
var table = require('../table');

// NameIDs for the name table.
var nameTableNames = [
    'copyright',              // 0
    'fontFamily',             // 1
    'fontSubfamily',          // 2
    'uniqueID',               // 3
    'fullName',               // 4
    'version',                // 5
    'postScriptName',         // 6
    'trademark',              // 7
    'manufacturer',           // 8
    'designer',               // 9
    'description',            // 10
    'vendorURL',              // 11
    'designerURL',            // 12
    'licence',                // 13
    'licenceURL',             // 14
    'reserved',               // 15
    'preferredFamily',        // 16
    'preferredSubfamily',     // 17
    'compatibleFullName',     // 18
    'sampleText',             // 19
    'postScriptFindFontName', // 20
    'wwsFamily',              // 21
    'wwsSubfamily'            // 22
];

// Parse the naming `name` table
// Only Windows Unicode English names are supported.
// Format 1 additional fields are not supported
function parseNameTable(data, start) {
    var name = {},
        p = new parse.Parser(data, start);
    name.format = p.parseUShort();
    var count = p.parseUShort(),
        stringOffset = p.offset + p.parseUShort();
    var platformID, encodingID, languageID, nameID, property, byteLength,
        offset, str, i, j, codePoints;
    var unknownCount = 0;
    for(i = 0; i < count; i++) {
        platformID = p.parseUShort();
        encodingID = p.parseUShort();
        languageID = p.parseUShort();
        nameID = p.parseUShort();
        property = nameTableNames[nameID];
        byteLength = p.parseUShort();
        offset = p.parseUShort();
        // platformID - encodingID - languageID standard combinations :
        // 1 - 0 - 0 : Macintosh, Roman, English
        // 3 - 1 - 0x409 : Windows, Unicode BMP (UCS-2), en-US
        if (platformID === 3 && encodingID === 1 && languageID === 0x409) {
            codePoints = [];
            var length = byteLength/2;
            for(j = 0; j < length; j++, offset += 2) {
                codePoints[j] = parse.getShort(data, stringOffset+offset);
            }
            str = String.fromCharCode.apply(null, codePoints);
            if (property) {
                name[property] = str;
            }
            else {
                unknownCount++;
                name['unknown'+unknownCount] = str;
            }
        }

    }
    if (name.format === 1) {
        name.langTagCount = p.parseUShort();
    }
    return name;
}

function makeNameRecord(platformID, encodingID, languageID, nameID, string) {
    return new table.Table('NameRecord', [
        {name: 'platformID', type: 'USHORT', value: platformID},
        {name: 'encodingID', type: 'USHORT', value: encodingID},
        {name: 'languageID', type: 'USHORT', value: languageID},
        {name: 'nameID', type: 'USHORT', value: nameID},
        {name: 'length', type: 'USHORT', value: string.length},
        {name: 'offset', type: 'USHORT', value: 0},
    ]);
}

function addNameRecord(t, recordID, s) {
    // Macintosh, Roman, English
    var stringBytes = encode.STRING(s);
    t.records.push(makeNameRecord(1, 0, 0, recordID, stringBytes));
    t.strings.push(stringBytes);
    // Windows, Unicode BMP (UCS-2), US English
    var utf16Bytes = encode.UTF16(s);
    t.records.push(makeNameRecord(3, 1, 0x0409, recordID, utf16Bytes));
    t.strings.push(utf16Bytes);
}

function makeNameTable(options) {
    var i;
    var t = new table.Table('name', [
        {name: 'format', type: 'USHORT', value: 0},
        {name: 'count', type: 'USHORT', value: 0},
        {name: 'stringOffset', type: 'USHORT', value: 0}
    ]);
    t.records = [];
    t.strings = [];
    for (i = 0; i < nameTableNames.length; i += 1) {
        if (options[nameTableNames[i]] !== undefined) {
            var s = options[nameTableNames[i]];
            addNameRecord(t, i, s);
        }
    }
    for (i = 0; i < t.records.length; i += 1) {
        t.fields.push({name: 'record_' + i, type: 'NameRecord', value: t.records[i]});
    }
    for (i = 0; i < t.strings.length; i += 1) {
        t.fields.push({name: 'string_' + i, type: 'CHARSTRING', value: t.strings[i]});
    }
    return t;
}

exports.parse = parseNameTable;
exports.make = makeNameTable;
