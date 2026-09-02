/**
 * Firestore Data Audit Script
 * Verifies the actual data structure in threat_logs collection
 */

const { db, COLLECTIONS } = require('./config/firebase');

(async () => {
  try {
    const snap = await db.collection(COLLECTIONS.THREAT_LOGS).limit(100).get();
    
    console.log('═══════════════════════════════════════════════════');
    console.log('FIRESTORE THREAT_LOGS DATA AUDIT');
    console.log('═══════════════════════════════════════════════════');
    console.log('Total records found:', snap.size);
    console.log('');
    
    const attackTypes = {};
    const riskLevels = {};
    const sourceIps = new Set();
    let withoutAttackType = 0;
    
    snap.docs.forEach(doc => {
      const d = doc.data();
      
      // Count attack_type distribution
      if (d.attack_type) {
        attackTypes[d.attack_type] = (attackTypes[d.attack_type] || 0) + 1;
      } else {
        withoutAttackType++;
      }
      
      // Count risk_level distribution
      if (d.risk_level) {
        riskLevels[d.risk_level] = (riskLevels[d.risk_level] || 0) + 1;
      }
      
      // Collect source IPs
      if (d.source_ip) {
        sourceIps.add(d.source_ip);
      }
    });
    
    console.log('ATTACK_TYPE DISTRIBUTION:');
    Object.entries(attackTypes).forEach(([type, count]) => {
      console.log('  ' + type.padEnd(20) + '= ' + count);
    });
    if (withoutAttackType > 0) {
      console.log('  (missing attack_type) = ' + withoutAttackType);
    }
    console.log('');
    
    console.log('RISK_LEVEL DISTRIBUTION:');
    Object.entries(riskLevels).forEach(([level, count]) => {
      console.log('  ' + level.padEnd(20) + '= ' + count);
    });
    console.log('');
    
    console.log('SOURCE IP SAMPLES:');
    const ipArray = Array.from(sourceIps);
    ipArray.slice(0, 5).forEach(ip => console.log('  - ' + ip));
    if (ipArray.length > 5) {
      console.log('  ... and ' + (ipArray.length - 5) + ' more unique IPs');
    }
    console.log('');
    
    console.log('FIELD VERIFICATION:');
    const sample = snap.docs[0]?.data();
    if (sample) {
      console.log('Sample record fields:');
      console.log('  - attack_type:', sample.attack_type || '(missing)');
      console.log('  - risk_level:', sample.risk_level || '(missing)');
      console.log('  - confidence_score:', sample.confidence_score || '(missing)');
      console.log('  - source_ip:', sample.source_ip || '(missing)');
      console.log('  - timestamp:', sample.timestamp ? 'present' : '(missing)');
      console.log('  - user_email:', sample.user_email || '(missing)');
    }
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
