const dashboard_form = document.querySelectorAll('.dashboard-form');
const dash_form_btn = document.querySelectorAll('.dash-form-btn');
const users_form = document.querySelector('.users-form');

dash_form_btn.forEach((button, index) => {
    button.addEventListener('click', () => {
        console.log(button)
        dashboard_form.forEach(form => {
            form.classList.add("hidden");
        });

        dashboard_form[index].classList.remove('hidden');
    })
})

