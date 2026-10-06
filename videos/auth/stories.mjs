// One object per independently editable scene. All UI labels come from the app.
export const stories = {
  registro: {
    title: 'Cómo crear su cuenta', number: '01', duration: 42,
    scenes: [
      {duration:7, step:'1 DE 5 · EMPECEMOS', title:'Cree su cuenta,\npaso a paso.', deck:'Para propietarios y agencias en Costa Rica.', view:'homeRegister', tip:'Entre al sitio y toque «Crear una cuenta».', foot:'www.protectoradelalquiler.com'},
      {duration:6, step:'2 DE 5 · SUS DATOS', title:'Su cédula.\nSu nombre.', deck:'Complete los datos de identidad.', view:'identity', tip:'Si su nombre aparece automáticamente, revíselo.', foot:'Puede escribir la cédula con o sin guiones.'},
      {duration:7, step:'3 DE 5 · CONTACTO', title:'Un correo\nque pueda abrir.', deck:'Añada también su perfil de Facebook.', view:'contact', tip:'Use su nombre en Facebook, su usuario o el enlace de su perfil.', foot:'Ejemplo ficticio · No se envía ningún dato.'},
      {duration:7, step:'4 DE 5 · CLAVE Y TIPO', title:'Elija su clave\ny tipo de cuenta.', deck:'Propietario o agencia: elija lo que corresponda.', view:'registerSubmit', tip:'Clave: mínimo 8 caracteres, con letras y números.', foot:'Luego toque «Crear cuenta».'},
      {duration:8, step:'5 DE 5 · CONFIRME SU CORREO', title:'Revise su correo.\nAbra el enlace.', deck:'Busque el mensaje de confirmación de su cuenta.', view:'mailRegister', tip:'Revise también el correo no deseado.', foot:'El enlace confirma su correo para continuar.'},
      {duration:7, step:'EL SIGUIENTE PASO', title:'Comparta su\nprimera reseña.', deck:'Al confirmar su correo, puede iniciar sesión.', view:'review', tip:'Su primera reseña aprobada activa 3 meses de consultas.', foot:'Antes de la aprobación, puede entrar, pero aún no consultar.'},
    ]
  },
  recuperar: {
    title:'Cómo recuperar su clave', number:'02', duration:39,
    scenes:[
      {duration:6, step:'1 DE 4 · EMPECEMOS', title:'¿Olvidó\nsu clave?', deck:'Para una cuenta que ya tiene acceso a la plataforma.', view:'homeReset', tip:'Desde el inicio, toque «Recuperar mi clave».', foot:'www.protectoradelalquiler.com'},
      {duration:7, step:'2 DE 4 · SU CORREO', title:'Use el correo\nde su cuenta.', deck:'Escriba el correo de su cuenta con acceso ya habilitado.', view:'requestReset', tip:'Toque «Solicitar enlace de recuperación».', foot:'Si viene del sistema anterior, cree aquí una clave nueva.'},
      {duration:7, step:'3 DE 4 · EL ENLACE', title:'Abra el enlace\nmás reciente.', deck:'Revise su bandeja de entrada y el correo no deseado.', view:'mailReset', tip:'Si pidió varios enlaces, use solo el último.', foot:'Si no llega, revise el correo y espere 1 minuto antes de pedir otro.'},
      {duration:8, step:'4 DE 4 · CLAVE NUEVA', title:'Escriba una\nclave nueva.', deck:'Repítala en «Confirme la clave nueva».', view:'newPassword', tip:'Use al menos 8 caracteres, con letras y números.', foot:'Toque «Guardar clave nueva».'},
      {duration:5, step:'CONTINÚE EN SU CUENTA', title:'Vuelva a\nsu cuenta.', deck:'Cuando la plataforma confirme el cambio…', view:'continue', tip:'Toque «Continuar con mi cuenta».', foot:'Si activó la verificación en dos pasos, necesitará su código.'},
      {duration:6, step:'SI NECESITA AYUDA', title:'¿El enlace\nno funciona?', deck:'Si venció o ya se usó, pida uno nuevo.', view:'expired', tip:'Si su correo aún no tiene acceso, consulte a administración.', foot:'Abra siempre el mensaje más reciente.'},
    ]
  }
};
