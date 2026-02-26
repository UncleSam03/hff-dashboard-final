export const hffRegisterForm = {
    html: `
        <form class="or">
            <section class="form-logo"></section>
            <h3 id="form-title">HFF Participant Register</h3>
            
            <label class="question">
                <span class="question-label">First Name</span>
                <input name="/data/first_name" type="text" data-type-xml="string" required="required"/>
            </label>
            
            <label class="question">
                <span class="question-label">Last Name</span>
                <input name="/data/last_name" type="text" data-type-xml="string" required="required"/>
            </label>
            
            <fieldset class="question">
                <legend><span class="question-label">Gender</span></legend>
                <div class="option-wrapper">
                    <label>
                        <input name="/data/gender" type="radio" value="M" data-type-xml="select1" required="required"/>
                        <span class="option-label">Male</span>
                    </label>
                    <label>
                        <input name="/data/gender" type="radio" value="F" data-type-xml="select1" required="required"/>
                        <span class="option-label">Female</span>
                    </label>
                </div>
            </fieldset>
            
            <label class="question">
                <span class="question-label">Age</span>
                <input name="/data/age" type="number" data-type-xml="int"/>
            </label>
            
            <label class="question">
                <span class="question-label">Education</span>
                <input name="/data/education" type="text" data-type-xml="string"/>
            </label>
            
            <label class="question">
                <span class="question-label">Marital Status</span>
                <input name="/data/marital_status" type="text" data-type-xml="string"/>
            </label>
            
            <label class="question">
                <span class="question-label">Occupation</span>
                <input name="/data/occupation" type="text" data-type-xml="string"/>
            </label>

            <fieldset class="question" style="display:none;">
                <input name="/data/meta/instanceID" type="hidden" data-preload="uid"/>
            </fieldset>
        </form>
    `,
    model: `
        <data id="hff_register" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms">
          <first_name/>
          <last_name/>
          <gender/>
          <age/>
          <education/>
          <marital_status/>
          <occupation/>
          <meta>
            <instanceID/>
          </meta>
        </data>
    `
};
