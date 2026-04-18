// auth-gis.js
const GOOGLE_CLIENT_ID = '273442733710-1eqf1erm1vl9vsad2lb4krennldt1jhf.apps.googleusercontent.com';
window.ID_TOKEN=null;window.STAFF_ROLE=null;window.STAFF_EMAIL=null;window.CONTROL_AUTH=false;
const STAFF_KEY='app_staff_mode';
function setStaffSession(e){try{e?localStorage.setItem(STAFF_KEY,'1'):localStorage.removeItem(STAFF_KEY)}catch(e){}}
function isStaffSession(){try{return localStorage.getItem(STAFF_KEY)==='1'}catch(e){return false}}
function isAdmin(){return CONTROL_AUTH&&STAFF_ROLE==='admin'}
function syncStaffUI(){try{updateAdminMenu()}catch(e){}try{syncStaffBadge()}catch(e){}try{syncControlFormVisibility()}catch(e){}try{syncAddTripVisibility()}catch(e){}}
function renderGoogleButton(){const b=document.getElementById('googleSignIn');if(!b)return;b.innerHTML='';if(!(window.google&&google.accounts&&google.accounts.id))return;google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleCredentialResponse,cancel_on_tap_outside:true});google.accounts.id.renderButton(b,{theme:'outline',size:'large',shape:'pill',text:'signin_with',logo_alignment:'left'});} 
async function handleCredentialResponse(r){try{const t=r&&r.credential;if(!t)throw new Error();showLoading('Verificando…');const o=await API.apiLoginWithToken(t);if(o&&o.ok){ID_TOKEN=t;CONTROL_AUTH=true;STAFF_ROLE=o.role||'viewer';STAFF_EMAIL=o.email||'';setStaffSession(true);showView('view-choose');await loadTrips();hideControlBoard();setHash(['Inicio']);}else throw new Error(o&&o.message||'No autorizado')}catch(e){CONTROL_AUTH=false;ID_TOKEN=null;STAFF_ROLE=null;STAFF_EMAIL=null;setStaffSession(false);toast('Error de autenticación')}finally{hideLoading();syncStaffUI()}}
function openStaffLogin(){try{hideAdminMenu()}catch(e){}CONTROL_AUTH=false;ID_TOKEN=null;STAFF_ROLE=null;STAFF_EMAIL=null;setStaffSession(false);syncStaffUI();hideControlBoard();showView('view-control');setHash(['Staff']);(function w(){if(window.google&&google.accounts&&google.accounts.id)renderGoogleButton();else setTimeout(w,300)})();}
function doControlLogout(){CONTROL_AUTH=false;ID_TOKEN=null;STAFF_ROLE=null;STAFF_EMAIL=null;setStaffSession(false);syncStaffUI();hideControlBoard();toast('Sesión finalizada');backToChoose()}
window.openStaffLogin=openStaffLogin;window.doControlLogout=doControlLogout;window.isAdmin=isAdmin;window.isStaffSession=isStaffSession;
