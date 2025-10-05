const dashboard_form = document.querySelectorAll('.dashboardForm');
const formBtn = document.querySelectorAll('.dash-form-btn');

formBtn.forEach((button, index) => {
    console.log("clicked");
    button.addEventListener('click', () => {
        console.log(button)
        dashboard_form.forEach(form => {
            form.classList.add("hidden");
        });

        dashboard_form[index].classList.remove('hidden');
    })
})

