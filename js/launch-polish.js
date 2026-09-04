const RESIDENT_CLARITY_ID = 'residentPolicyClarity';

function residentClarityHtml() {
  return `
    <div id="${RESIDENT_CLARITY_ID}" class="policy-box" style="margin:12px 0 16px">
      <div><strong>城乡居民养老与职工养老是两套制度</strong></div>
      <div class="help" style="margin-top:4px">本入口不套用职工渐进式延迟退休，以及2030—2039年职工最低缴费年限由15年逐步提高到20年的规则。现行国家城乡居民养老统一框架仍按60周岁、累计缴费满15年判断基本领取条件；地方待遇和补缴等事项以参保地最新政策为准。</div>
    </div>`;
}

function injectResidentClarity() {
  const residentView = document.getElementById('residentView');
  if (!residentView || residentView.classList.contains('hidden')) return;
  if (residentView.querySelector(`#${RESIDENT_CLARITY_ID}`)) return;

  const wizardHead = residentView.querySelector('.wizard-head');
  if (wizardHead) {
    wizardHead.insertAdjacentHTML('afterend', residentClarityHtml());
    return;
  }

  const hero = residentView.querySelector('.result-hero');
  if (hero) hero.insertAdjacentHTML('afterend', residentClarityHtml());
}

function advanceToPrecisionStep(attempt = 0) {
  const wizardView = document.getElementById('wizardView');
  const stepTitle = document.getElementById('stepTitle');
  const nextBtn = document.getElementById('nextBtn');
  if (!wizardView || wizardView.classList.contains('hidden') || !stepTitle || !nextBtn) return;
  if (stepTitle.textContent.includes('最后补两项')) return;
  if (attempt >= 3) return;
  nextBtn.click();
  setTimeout(() => advanceToPrecisionStep(attempt + 1), 0);
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('#addAmountDataBtn')) return;
  // launch.js 先返回到方案编辑页；这里在其处理完成后继续前进到金额参数步骤。
  setTimeout(() => advanceToPrecisionStep(), 0);
}, { capture: true });

const observer = new MutationObserver(() => injectResidentClarity());
observer.observe(document.body, { childList: true, subtree: true });
injectResidentClarity();
